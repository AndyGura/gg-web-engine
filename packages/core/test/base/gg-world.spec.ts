import { Entity3d, GgWorld, GroupEntity, IEntity, IRendererEntity, TickOrder } from '../../src';
import { mock3DObject } from '../mocks/object.mock';
import { MockWorld } from '../mocks/world.mock';
import { mock3DBody } from '../mocks/body.mock';
import { collectConsoleCommands } from '../mocks/console-commands.mock';

class GgEntityMock extends IEntity {
  readonly tickOrder: TickOrder = TickOrder.OBJECTS_BINDING;
}

class TestRendererEntity extends IRendererEntity<any, any> {}

function makeFakeRenderer(overrides: Partial<any> = {}): any {
  return {
    camera: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
    rendererOptions: { transparent: false, background: 0, size: { x: 100, y: 100 }, antialias: true },
    physicsDebugViewActive: false,
    render: () => {},
    addToWorld: () => {},
    removeFromWorld: () => {},
    resizeRenderer: () => {},
    dispose: () => {},
    entity: null,
    ...overrides,
  } as any;
}

// an Entity3d with spied native components, the way a loaded model's entities look
function makeEntity3d(name: string) {
  const body = mock3DBody();
  body.name = name;
  const object3D = mock3DObject();
  const spies = {
    bodyAdd: jest.spyOn(body, 'addToWorld'),
    bodyRemove: jest.spyOn(body, 'removeFromWorld'),
    objectAdd: jest.spyOn(object3D, 'addToWorld'),
    objectRemove: jest.spyOn(object3D, 'removeFromWorld'),
  };
  return { entity: new Entity3d({ objectBody: body, object3D }), spies };
}

describe('GgWorld', () => {
  let world: GgWorld<any, any>;

  beforeEach(() => {
    jest.useFakeTimers();
    world = new MockWorld();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('addEntity', () => {
    it('should warn and no-op when adding an entity already spawned in another world', () => {
      const otherWorld = new MockWorld();
      const entity = new GgEntityMock();
      otherWorld.addEntity(entity);

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      world.addEntity(entity);

      expect(warnSpy).toHaveBeenCalledWith('Trying to spawn entity, which is already spawned');
      expect(entity.world).toBe(otherWorld);
      warnSpy.mockRestore();
    });

    it('should silently no-op, without warning, when the entity is already spawned in this world', () => {
      const entity = new GgEntityMock();
      world.addEntity(entity);

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      world.addEntity(entity);

      expect(warnSpy).not.toHaveBeenCalled();
      expect(world.children.filter(e => e === entity).length).toBe(1);
      warnSpy.mockRestore();
    });

    it('should let an already-spawned entity be reparented under another entity in the same world without warning', () => {
      const parent = new GgEntityMock();
      const child = new GgEntityMock();
      world.addEntity(parent);
      world.addEntity(child);

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      parent.addChildren(child);

      expect(warnSpy).not.toHaveBeenCalled();
      expect(child.parent).toBe(parent);
      expect(world.children.filter(e => e === child).length).toBe(1);
      warnSpy.mockRestore();
    });

    it('should throw when adding an entity that has already been disposed', () => {
      const entity = new GgEntityMock();
      entity.name = 'Gone';
      world.addEntity(entity);
      world.removeEntity(entity, true);
      expect(entity.disposed).toBe(true);

      expect(() => world.addEntity(entity)).toThrow('Cannot add entity - it has already been disposed');
      expect(entity.world).toBeNull();
    });

    it('should throw, and leave the world unchanged, when adding an entity whose name is already in use', () => {
      const first = new GgEntityMock();
      first.name = 'Dup';
      world.addEntity(first);

      const second = new GgEntityMock();
      second.name = 'Dup';

      expect(() => world.addEntity(second)).toThrow(
        'Cannot add entity - name "Dup" is already in use by another entity in this world',
      );
      expect(second.world).toBeNull();
      expect(world.getEntityByName('Dup')).toBe(first);
    });

    describe('atomicity of a nested entity tree', () => {
      it('should throw, without ever touching the native scenes, when a nested child collides with an existing entity', () => {
        const existing = new GgEntityMock();
        existing.name = 'Suzanne';
        world.addEntity(existing);
        const childrenBefore = world.children.length;

        const group = new GroupEntity();
        const okChild = makeEntity3d('Floor');
        const dupChild = makeEntity3d('Suzanne');
        group.addChildren(okChild.entity, dupChild.entity);

        expect(() => world.addEntity(group)).toThrow(
          'Cannot add entity - name "Suzanne" is already in use by another entity in this world',
        );

        expect(group.world).toBeNull();
        expect(okChild.entity.world).toBeNull();
        expect(dupChild.entity.world).toBeNull();
        expect(world.children.length).toBe(childrenBefore);
        expect(world.getEntityByName('Suzanne')).toBe(existing);
        expect(() => world.getEntityByName('Floor')).toThrow();
        for (const c of [okChild, dupChild]) {
          expect(c.spies.bodyAdd).not.toHaveBeenCalled();
          expect(c.spies.objectAdd).not.toHaveBeenCalled();
        }
        // the group and its children are still a valid, intact tree that can be added once the
        // collision is resolved
        dupChild.entity.name = 'Suzanne.001';
        world.addEntity(group);
        expect(world.getEntityByName('Suzanne.001')).toBe(dupChild.entity);
        expect(world.getEntityByName('Floor')).toBe(okChild.entity);
        expect(dupChild.spies.bodyAdd).toHaveBeenCalledTimes(1);
        expect(dupChild.spies.objectAdd).toHaveBeenCalledTimes(1);
      });

      it('should throw, without ever touching the native scenes, when two entities of the tree share a name', () => {
        const group = new GroupEntity();
        const first = makeEntity3d('Suzanne');
        const second = makeEntity3d('Suzanne');
        group.addChildren(first.entity, second.entity);

        expect(() => world.addEntity(group)).toThrow(
          'Cannot add entity - name "Suzanne" is used by more than one entity within the entity tree being added',
        );

        expect(group.world).toBeNull();
        expect(first.entity.world).toBeNull();
        expect(second.entity.world).toBeNull();
        expect(world.children).not.toContain(group);
        expect(() => world.getEntityByName('Suzanne')).toThrow();
        for (const c of [first, second]) {
          expect(c.spies.bodyAdd).not.toHaveBeenCalled();
          expect(c.spies.objectAdd).not.toHaveBeenCalled();
        }
      });

      it('should validate names at every nesting depth, not just direct children', () => {
        const existing = new GgEntityMock();
        existing.name = 'Deep';
        world.addEntity(existing);

        const root = new GroupEntity();
        const mid = new GroupEntity();
        const leaf = new GgEntityMock();
        leaf.name = 'Deep';
        mid.addChildren(leaf);
        root.addChildren(mid);

        expect(() => world.addEntity(root)).toThrow('name "Deep" is already in use');
        expect(root.world).toBeNull();
        expect(mid.world).toBeNull();
        expect(leaf.world).toBeNull();
      });

      it('should still let an already-spawned entity be reparented under a tree being added', () => {
        const alreadyIn = new GgEntityMock();
        alreadyIn.name = 'AlreadyIn';
        world.addEntity(alreadyIn);

        const group = new GroupEntity();
        group.addChildren(alreadyIn);
        expect(alreadyIn.world).toBe(world);

        expect(() => world.addEntity(group)).not.toThrow();
        expect(group.world).toBe(world);
        expect(alreadyIn.parent).toBe(group);
        expect(world.getEntityByName('AlreadyIn')).toBe(alreadyIn);
        expect(world.children.filter(e => e === alreadyIn).length).toBe(1);
      });

      it('should roll back everything already spawned when spawning throws partway for any other reason', () => {
        const group = new GroupEntity();
        const okChild = makeEntity3d('Floor');
        const broken = makeEntity3d('Broken');
        broken.spies.bodyAdd.mockImplementation(() => {
          throw new Error('native body creation failed');
        });
        const later = makeEntity3d('Later');
        group.addChildren(okChild.entity, broken.entity, later.entity);

        expect(() => world.addEntity(group)).toThrow('native body creation failed');

        expect(group.world).toBeNull();
        expect(world.children).not.toContain(group);
        for (const e of [okChild.entity, broken.entity, later.entity]) {
          expect(e.world).toBeNull();
          expect(world.children).not.toContain(e);
          expect(() => world.getEntityByName(e.name)).toThrow();
        }
        // whatever did reach the native scenes before the failure was pulled back out again
        expect(okChild.spies.bodyAdd).toHaveBeenCalledTimes(1);
        expect(okChild.spies.bodyRemove).toHaveBeenCalledTimes(1);
        expect(okChild.spies.objectAdd).toHaveBeenCalledTimes(1);
        expect(okChild.spies.objectRemove).toHaveBeenCalledTimes(1);
        expect(broken.spies.objectAdd).not.toHaveBeenCalled();
        expect(broken.spies.objectRemove).not.toHaveBeenCalled();
        expect(later.spies.bodyAdd).not.toHaveBeenCalled();
        expect(later.spies.objectAdd).not.toHaveBeenCalled();
        // and the names are free again
        const fresh = new GgEntityMock();
        fresh.name = 'Floor';
        expect(() => world.addEntity(fresh)).not.toThrow();
      });

      it("should only roll back a single entity's own components that actually attached, not ones whose addToWorld never ran", () => {
        // Entity3d adds its objectBody component before its object3D component (see its
        // constructor) - so making the *second* component's addToWorld throw means the first
        // component genuinely reached the native scene before the failure, while the second one
        // never did. Only the first should ever see removeFromWorld.
        const { entity, spies } = makeEntity3d('Broken');
        spies.objectAdd.mockImplementation(() => {
          throw new Error('native object creation failed');
        });

        expect(() => world.addEntity(entity)).toThrow('native object creation failed');

        expect(entity.world).toBeNull();
        expect(spies.bodyAdd).toHaveBeenCalledTimes(1);
        expect(spies.bodyRemove).toHaveBeenCalledTimes(1);
        expect(spies.objectAdd).toHaveBeenCalledTimes(1);
        // the crux of the fix: removeFromWorld must never run on a component whose addToWorld
        // never succeeded, since adapter implementations generally assume the reverse and free a
        // native handle that, here, was never allocated
        expect(spies.objectRemove).not.toHaveBeenCalled();
      });
    });
  });

  describe('entityAdded$ / entityRemoved$', () => {
    it('emits entityAdded$ once, after the entity is fully attached to the world', () => {
      const { entity, spies } = makeEntity3d('Spawned');
      const received: IEntity[] = [];
      let worldAtEmission: GgWorld<any, any> | null = null;
      world.entityAdded$.subscribe(e => {
        received.push(e);
        worldAtEmission = e.world;
      });

      world.addEntity(entity);

      expect(received).toEqual([entity]);
      expect(worldAtEmission).toBe(world);
      expect(spies.bodyAdd).toHaveBeenCalledTimes(1);
    });

    it('emits entityAdded$ for nested children before their parent, cascading through onSpawned', () => {
      const group = new GroupEntity();
      const child1 = makeEntity3d('Child1');
      const child2 = makeEntity3d('Child2');
      group.addChildren(child1.entity, child2.entity);
      const received: IEntity[] = [];
      world.entityAdded$.subscribe(e => received.push(e));

      world.addEntity(group);

      expect(received).toEqual([child1.entity, child2.entity, group]);
    });

    it('does not emit entityAdded$ when addEntity throws because of a name collision', () => {
      const existing = new GgEntityMock();
      existing.name = 'Dup';
      world.addEntity(existing);
      const second = new GgEntityMock();
      second.name = 'Dup';
      const received: IEntity[] = [];
      world.entityAdded$.subscribe(e => received.push(e));

      expect(() => world.addEntity(second)).toThrow();

      expect(received).toEqual([]);
    });

    it('never emits entityAdded$ for an entity whose own spawn throws or gets rolled back, even though an already-spawned sibling swept up in the same rollback gets a matching entityRemoved$', () => {
      const group = new GroupEntity();
      const okChild = makeEntity3d('Floor');
      const broken = makeEntity3d('Broken');
      broken.spies.bodyAdd.mockImplementation(() => {
        throw new Error('native body creation failed');
      });
      const later = makeEntity3d('Later');
      group.addChildren(okChild.entity, broken.entity, later.entity);
      const added: IEntity[] = [];
      const removed: IEntity[] = [];
      world.entityAdded$.subscribe(e => added.push(e));
      world.entityRemoved$.subscribe(e => removed.push(e));

      expect(() => world.addEntity(group)).toThrow('native body creation failed');

      // okChild genuinely finished spawning (and so emitted entityAdded$) before `broken` failed and
      // the whole subtree was rolled back, so it also genuinely gets removed again (entityRemoved$) -
      // `broken`, `later` and `group` itself never successfully spawned, so neither event ever fires
      // for them
      expect(added).toEqual([okChild.entity]);
      expect(removed).toEqual([okChild.entity]);
    });

    it('emits entityRemoved$ once, after the entity is fully detached from the world', () => {
      const { entity, spies } = makeEntity3d('Removable');
      world.addEntity(entity);
      const received: IEntity[] = [];
      let worldAtEmission: GgWorld<any, any> | null = null;
      world.entityRemoved$.subscribe(e => {
        received.push(e);
        worldAtEmission = e.world;
      });

      world.removeEntity(entity);

      expect(received).toEqual([entity]);
      expect(worldAtEmission).toBeNull();
      expect(spies.bodyRemove).toHaveBeenCalledTimes(1);
    });

    it('emits entityRemoved$ for nested children before their parent, cascading through onRemoved', () => {
      const group = new GroupEntity();
      const child1 = makeEntity3d('Child1');
      const child2 = makeEntity3d('Child2');
      group.addChildren(child1.entity, child2.entity);
      world.addEntity(group);
      const received: IEntity[] = [];
      world.entityRemoved$.subscribe(e => received.push(e));

      world.removeEntity(group);

      expect(received).toEqual([child1.entity, child2.entity, group]);
    });

    it('does not emit entityRemoved$ for a no-op removeEntity call on an entity not part of this world', () => {
      const entity = new GgEntityMock();
      const received: IEntity[] = [];
      world.entityRemoved$.subscribe(e => received.push(e));

      world.removeEntity(entity);

      expect(received).toEqual([]);
    });

    it('does not emit entityRemoved$ for children torn down as part of world.dispose() itself', () => {
      const entity = new GgEntityMock();
      entity.name = 'Torn';
      world.addEntity(entity);
      const received: IEntity[] = [];
      world.entityRemoved$.subscribe(e => received.push(e));

      world.dispose();

      expect(received).toEqual([]);
    });

    it('completes both entityAdded$ and entityRemoved$ when the world is disposed', () => {
      let addedCompleted = false;
      let removedCompleted = false;
      world.entityAdded$.subscribe({ complete: () => (addedCompleted = true) });
      world.entityRemoved$.subscribe({ complete: () => (removedCompleted = true) });

      world.dispose();

      expect(addedCompleted).toBe(true);
      expect(removedCompleted).toBe(true);
    });
  });

  describe('renaming a spawned entity', () => {
    it('should update the world name index, so the entity is found under its new name and not the old one', () => {
      const entity = new GgEntityMock();
      entity.name = 'Before';
      world.addEntity(entity);

      entity.name = 'After';

      expect(world.getEntityByName('After')).toBe(entity);
      expect(() => world.getEntityByName('Before')).toThrow('No entity named "Before" found in the world');
    });

    it('should throw, and leave both entities under their original names, when renamed to a name already in use', () => {
      const first = new GgEntityMock();
      first.name = 'Alice';
      world.addEntity(first);
      const second = new GgEntityMock();
      second.name = 'Bob';
      world.addEntity(second);

      expect(() => (second.name = 'Alice')).toThrow(
        'Cannot rename entity "Bob" to "Alice" - name already in use by another entity in this world',
      );
      expect(second.name).toBe('Bob');
      expect(world.getEntityByName('Alice')).toBe(first);
      expect(world.getEntityByName('Bob')).toBe(second);
    });

    it('should allow renaming an entity not (yet) part of any world, with no uniqueness check', () => {
      const entity = new GgEntityMock();
      entity.name = 'Free';
      expect(entity.name).toBe('Free');
    });
  });

  describe('getEntityByName', () => {
    it('should find a top-level entity by name', () => {
      const entity = new GgEntityMock();
      entity.name = 'Top';
      world.addEntity(entity);

      expect(world.getEntityByName('Top')).toBe(entity);
    });

    it('should find a nested entity by name - world.children is flat regardless of parenting', () => {
      const parent = new GgEntityMock();
      const child = new GgEntityMock();
      child.name = 'Nested';
      world.addEntity(parent);
      parent.addChildren(child);

      expect(world.getEntityByName('Nested')).toBe(child);
    });

    it('should throw for a name no entity in the world has', () => {
      expect(() => world.getEntityByName('Missing')).toThrow('No entity named "Missing" found in the world');
    });

    it('should stop finding a removed entity - lookup is live, not a stale cache', () => {
      const entity = new GgEntityMock();
      entity.name = 'Removable';
      world.addEntity(entity);
      expect(world.getEntityByName('Removable')).toBe(entity);

      world.removeEntity(entity, true);

      expect(() => world.getEntityByName('Removable')).toThrow('No entity named "Removable" found in the world');
    });
  });

  describe('console commands', () => {
    describe('timescale', () => {
      it('reports the current time scale with no args', async () => {
        const commands = collectConsoleCommands(world);
        expect(await commands.get('timescale')!()).toBe('1');
      });

      it('sets the time scale when given a numeric arg', async () => {
        const commands = collectConsoleCommands(world);
        expect(await commands.get('timescale')!('2')).toBe('2');
        expect(world.worldClock.timeScale).toBe(2);
      });

      it('ignores a non-numeric arg and just reports the current value', async () => {
        const commands = collectConsoleCommands(world);
        expect(await commands.get('timescale')!('abc')).toBe('1');
      });

      it('pauses the clock when set to 0 (what "step" requires)', async () => {
        const commands = collectConsoleCommands(world);
        await commands.get('timescale')!('0');
        expect(world.worldClock.isPaused).toBe(true);
      });
    });

    describe('fps_limit', () => {
      it('gets and sets the tick rate limit', async () => {
        const commands = collectConsoleCommands(world);
        expect(await commands.get('fps_limit')!()).toBe('0');
        expect(await commands.get('fps_limit')!('30')).toBe('30');
        expect(world.worldClock.tickRateLimit).toBe(30);
      });
    });

    describe('step', () => {
      it('rejects when the world is not paused', async () => {
        const commands = collectConsoleCommands(world);
        await expect(commands.get('step')!()).rejects.toThrow(
          'World must be paused first (run "timescale 0") before it can be stepped',
        );
      });

      it('defaults to 1000/120 ms and advances the paused clock', async () => {
        const commands = collectConsoleCommands(world);
        world.worldClock.start();
        world.worldClock.pause();
        expect(await commands.get('step')!()).toBe(`stepped ${1000 / 120} ms`);
        expect(world.worldClock.elapsedTime).toBeCloseTo(1000 / 120);
      });

      it('accepts an explicit ms argument', async () => {
        const commands = collectConsoleCommands(world);
        world.worldClock.start();
        world.worldClock.pause();
        expect(await commands.get('step')!('16')).toBe('stepped 16 ms');
        expect(world.worldClock.elapsedTime).toBeCloseTo(16);
      });

      it('rejects a non-positive ms argument', async () => {
        const commands = collectConsoleCommands(world);
        world.worldClock.pause();
        await expect(commands.get('step')!('0')).rejects.toThrow();
        await expect(commands.get('step')!('-5')).rejects.toThrow();
      });
    });

    describe('renderers / debug_view', () => {
      it('renderers lists nothing when the world has no renderer', async () => {
        const commands = collectConsoleCommands(world);
        expect(await commands.get('renderers')!()).toBe('');
      });

      it('renderers lists renderer entity names', async () => {
        const commands = collectConsoleCommands(world);
        const renderer = new TestRendererEntity(makeFakeRenderer());
        renderer.name = 'main';
        world.addEntity(renderer);

        expect(await commands.get('renderers')!()).toBe('main');
      });

      it('debug_view rejects when there is no renderer', async () => {
        const commands = collectConsoleCommands(world);
        await expect(commands.get('debug_view')!()).rejects.toThrow('No renderer found');
      });

      it('debug_view toggles the first renderer by default', async () => {
        const commands = collectConsoleCommands(world);
        const fake = makeFakeRenderer();
        const renderer = new TestRendererEntity(fake);
        renderer.name = 'main';
        world.addEntity(renderer);

        expect(await commands.get('debug_view')!()).toBe('1');
        expect(fake.physicsDebugViewActive).toBe(true);
        expect(await commands.get('debug_view')!()).toBe('0');
        expect(fake.physicsDebugViewActive).toBe(false);
      });

      it('debug_view sets an explicit value on a renderer picked by name', async () => {
        const commands = collectConsoleCommands(world);
        const fakeA = makeFakeRenderer();
        const rendererA = new TestRendererEntity(fakeA);
        rendererA.name = 'a';
        world.addEntity(rendererA);
        const fakeB = makeFakeRenderer();
        const rendererB = new TestRendererEntity(fakeB);
        rendererB.name = 'b';
        world.addEntity(rendererB);

        expect(await commands.get('debug_view')!('1', 'b')).toBe('1');
        expect(fakeB.physicsDebugViewActive).toBe(true);
        expect(fakeA.physicsDebugViewActive).toBe(false);
      });

      it('debug_view rejects an unknown renderer name', async () => {
        const commands = collectConsoleCommands(world);
        const renderer = new TestRendererEntity(makeFakeRenderer());
        renderer.name = 'main';
        world.addEntity(renderer);

        await expect(commands.get('debug_view')!('1', 'missing')).rejects.toThrow(
          'Renderer with name "missing" not found',
        );
      });
    });

    describe('performance', () => {
      it('measures elapsed frame time for entities over the sampling window (default 20 samples, avg mode)', async () => {
        await world.init();
        const commands = collectConsoleCommands(world);
        const entity = new GgEntityMock();
        entity.name = 'thing';
        world.addEntity(entity);

        const resultPromise = commands.get('performance')!();
        for (let i = 0; i < 20; i++) {
          (world.worldClock as any)._tick$.next([i * 16, 16]);
        }
        const result = await resultPromise;

        expect(result).toContain('Performance report (20 samples)');
        expect(result).toContain('Average Frame time');
        expect(result).toContain('thing');
      });

      it('supports overriding sample count and switching to peak mode', async () => {
        await world.init();
        const commands = collectConsoleCommands(world);

        const resultPromise = commands.get('performance')!('peak', '2');
        (world.worldClock as any)._tick$.next([0, 16]);
        (world.worldClock as any)._tick$.next([16, 16]);
        const result = await resultPromise;

        expect(result).toContain('Performance report (2 samples)');
        expect(result).toContain('Peak Frame time');
      });
    });

    describe('entities', () => {
      it('lists all entities with their class name', async () => {
        const commands = collectConsoleCommands(world);
        const a = new GgEntityMock();
        a.name = 'Alpha';
        const b = new GgEntityMock();
        b.name = 'Beta';
        world.addEntity(a);
        world.addEntity(b);

        const result = await commands.get('entities')!();
        expect(result).toContain('Alpha');
        expect(result).toContain('Beta');
        expect(result).toContain('GgEntityMock');
      });

      it('filters by a case-insensitive substring', async () => {
        const commands = collectConsoleCommands(world);
        const a = new GgEntityMock();
        a.name = 'Alpha';
        const b = new GgEntityMock();
        b.name = 'Beta';
        world.addEntity(a);
        world.addEntity(b);

        const result = await commands.get('entities')!('AL');
        expect(result).toContain('Alpha');
        expect(result).not.toContain('Beta');
      });

      it('reports no entities when the world/filter is empty', async () => {
        const commands = collectConsoleCommands(world);
        expect(await commands.get('entities')!()).toContain('no entities');
      });
    });

    describe('entity', () => {
      it('requires a name argument', async () => {
        const commands = collectConsoleCommands(world);
        await expect(commands.get('entity')!()).rejects.toThrow('usage: entity NAME');
      });

      it('rejects an unknown name', async () => {
        const commands = collectConsoleCommands(world);
        await expect(commands.get('entity')!('missing')).rejects.toThrow(
          'No entity named "missing" found in the world',
        );
      });

      it('dumps class, active flag, parent and children', async () => {
        const commands = collectConsoleCommands(world);
        const parent = new GgEntityMock();
        parent.name = 'Parent';
        const child = new GgEntityMock();
        child.name = 'Child';
        world.addEntity(parent);
        parent.addChildren(child);

        const result = await commands.get('entity')!('Parent');
        expect(result).toContain('class: GgEntityMock');
        expect(result).toContain('active: true');
        expect(result).toContain('parent: (none)');
        expect(result).toContain('children: Child');
      });

      it('includes position/rotation only for entities that have them', async () => {
        const commands = collectConsoleCommands(world);
        const objectBody = mock3DBody();
        objectBody.position = { x: 1, y: 2, z: 3 };
        const entity = new Entity3d({ objectBody });
        entity.name = 'Positioned';
        world.addEntity(entity);

        const result = await commands.get('entity')!('Positioned');
        expect(result).toContain('position: {"x":1,"y":2,"z":3}');
      });
    });

    describe('remove', () => {
      it('requires a name argument', async () => {
        const commands = collectConsoleCommands(world);
        await expect(commands.get('remove')!()).rejects.toThrow('usage: remove NAME');
      });

      it('removes and disposes by default', async () => {
        const commands = collectConsoleCommands(world);
        const entity = new GgEntityMock();
        entity.name = 'Removable';
        world.addEntity(entity);
        const disposeSpy = jest.spyOn(entity, 'dispose');

        expect(await commands.get('remove')!('Removable')).toBe('removed "Removable"');
        expect(world.children).not.toContain(entity);
        expect(disposeSpy).toHaveBeenCalled();
      });

      it('detaches without disposing when told not to', async () => {
        const commands = collectConsoleCommands(world);
        const entity = new GgEntityMock();
        entity.name = 'Removable';
        world.addEntity(entity);
        const disposeSpy = jest.spyOn(entity, 'dispose');

        await commands.get('remove')!('Removable', '0');
        expect(world.children).not.toContain(entity);
        expect(disposeSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('audio listener auto-bind', () => {
    function makeFakeAudioScene(): any {
      let activeListener: any = null;
      return {
        init: async () => {},
        dispose: () => {},
        update: () => {},
        get activeListener() {
          return activeListener;
        },
        setActiveListener: (target: any) => {
          activeListener = target;
        },
      };
    }

    function worldWithAudioScene(audioScene: any): GgWorld<any, any> {
      class MockWorldWithAudio extends GgWorld<any, any> {
        constructor() {
          super({
            visualScene: { init: async () => {}, dispose: () => {} } as any,
            physicsWorld: { init: async () => {}, simulate: () => {}, dispose: () => {} } as any,
            audioScene,
          });
        }

        addPrimitiveRigidBody(): any {
          return undefined;
        }
      }
      return new MockWorldWithAudio();
    }

    it('does nothing when the world has no audioScene', () => {
      // MockWorld (the default `world` from the outer beforeEach) has no audioScene at all
      const renderer = new TestRendererEntity(makeFakeRenderer());
      expect(() => world.addEntity(renderer)).not.toThrow();
    });

    it('binds the listener to the sole renderer camera automatically', () => {
      const audioScene = makeFakeAudioScene();
      const audioWorld = worldWithAudioScene(audioScene);
      const fakeRenderer = makeFakeRenderer();
      const renderer = new TestRendererEntity(fakeRenderer);
      renderer.name = 'main';

      audioWorld.addEntity(renderer);

      expect(audioScene.activeListener).toBe(fakeRenderer.camera);
    });

    it('does not guess, and warns, once a second renderer is added with no explicit listener', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const audioScene = makeFakeAudioScene();
      const audioWorld = worldWithAudioScene(audioScene);
      const first = new TestRendererEntity(makeFakeRenderer());
      first.name = 'main';
      const second = new TestRendererEntity(makeFakeRenderer());
      second.name = 'minimap';

      audioWorld.addEntity(first);
      const listenerAfterFirst = audioScene.activeListener;
      audioWorld.addEntity(second);

      expect(audioScene.activeListener).toBe(listenerAfterFirst); // unchanged - no guessing
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('2 renderers present'));
      warnSpy.mockRestore();
    });

    it('never overrides a listener the app already set explicitly', () => {
      const audioScene = makeFakeAudioScene();
      const explicitListener = { position: { x: 9, y: 9, z: 9 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
      audioScene.setActiveListener(explicitListener);
      const audioWorld = worldWithAudioScene(audioScene);
      const renderer = new TestRendererEntity(makeFakeRenderer());
      renderer.name = 'main';

      audioWorld.addEntity(renderer);

      expect(audioScene.activeListener).toBe(explicitListener);
    });

    it('keeps an explicitly-set listener even after the sole renderer is swapped out for another one', () => {
      const audioScene = makeFakeAudioScene();
      const audioWorld = worldWithAudioScene(audioScene);
      const first = new TestRendererEntity(makeFakeRenderer());
      first.name = 'main';
      audioWorld.addEntity(first);
      expect(audioScene.activeListener).toBe(first.camera); // auto-bound so far

      const explicitListener = { position: { x: 9, y: 9, z: 9 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
      audioScene.setActiveListener(explicitListener); // app takes over explicitly
      audioWorld.removeEntity(first);

      const second = new TestRendererEntity(makeFakeRenderer());
      second.name = 'main';
      audioWorld.addEntity(second); // renderer swap - world is back down to exactly one renderer

      // must still be the app's explicit choice - the earlier auto-bind must not re-arm and
      // clobber it just because the renderer count dropped back to one
      expect(audioScene.activeListener).toBe(explicitListener);
    });
  });

  describe('tab visibility', () => {
    function setVisibility(state: 'visible' | 'hidden') {
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }

    afterEach(() => {
      // restore jsdom's default so later tests/suites see a clean 'visible' document
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    });

    it('defaults pauseWhenHidden to false and does not pause when hidden', async () => {
      const plainWorld = new MockWorld();
      expect(plainWorld.pauseWhenHidden).toBe(false);
      await plainWorld.init();
      plainWorld.start();

      setVisibility('hidden');

      expect(plainWorld.isPaused).toBe(false);
      plainWorld.dispose();
    });

    it('pauses on hidden and resumes on visible again when pauseWhenHidden is true', async () => {
      const hiddenWorld = new MockWorld({ pauseWhenHidden: true });
      await hiddenWorld.init();
      hiddenWorld.start();
      expect(hiddenWorld.isPaused).toBe(false);

      setVisibility('hidden');
      expect(hiddenWorld.isPaused).toBe(true);

      setVisibility('visible');
      expect(hiddenWorld.isPaused).toBe(false);

      hiddenWorld.dispose();
    });

    it('does not resume a world the app paused itself before the tab was hidden', async () => {
      const hiddenWorld = new MockWorld({ pauseWhenHidden: true });
      await hiddenWorld.init();
      hiddenWorld.start();
      hiddenWorld.pauseWorld(); // app-initiated pause
      expect(hiddenWorld.isPaused).toBe(true);

      setVisibility('hidden');
      setVisibility('visible');

      // still paused - the visibility handler must never resume a pause it didn't cause itself
      expect(hiddenWorld.isPaused).toBe(true);

      hiddenWorld.dispose();
    });

    it('does not re-pause on a further hidden event while already hidden, and only resumes once', async () => {
      const hiddenWorld = new MockWorld({ pauseWhenHidden: true });
      await hiddenWorld.init();
      hiddenWorld.start();

      setVisibility('hidden');
      setVisibility('hidden');
      expect(hiddenWorld.isPaused).toBe(true);

      setVisibility('visible');
      expect(hiddenWorld.isPaused).toBe(false);

      hiddenWorld.dispose();
    });

    it('exposes visibility$ regardless of pauseWhenHidden', async () => {
      const plainWorld = new MockWorld();
      await plainWorld.init();
      const states: boolean[] = [];
      plainWorld.visibility$.subscribe(v => states.push(v));

      setVisibility('hidden');
      setVisibility('visible');

      expect(states).toEqual([false, true]);
      plainWorld.dispose();
    });

    it('stops reacting to visibilitychange once disposed', async () => {
      const hiddenWorld = new MockWorld({ pauseWhenHidden: true });
      await hiddenWorld.init();
      hiddenWorld.start();
      hiddenWorld.dispose();

      expect(() => setVisibility('hidden')).not.toThrow();
    });
  });

  describe('fixedPhysicsStep', () => {
    function makePhysicsWorldMock() {
      return {
        init: async () => {},
        simulate: jest.fn(),
        dispose: () => {},
      };
    }

    // Drives the world's tick loop manually via `worldClock.step()`, the same deterministic
    // pattern the "step" console command itself uses - see `PausableClock.step`'s own doc.
    async function makeSteppableWorld(opts: { fixedPhysicsStep?: number; maxPhysicsStepsPerTick?: number }) {
      const physicsWorld = makePhysicsWorldMock();
      const w = new MockWorld({ physicsWorld, ...opts });
      await w.init();
      w.worldClock.start();
      w.worldClock.pause();
      return { world: w, physicsWorld };
    }

    it('leaves the original behavior unchanged when unset: simulate(delta) once per tick', async () => {
      const { world: w, physicsWorld } = await makeSteppableWorld({});

      w.worldClock.step(50);

      expect(physicsWorld.simulate).toHaveBeenCalledTimes(1);
      expect(physicsWorld.simulate).toHaveBeenCalledWith(50);
    });

    it('a 50ms tick at fixedPhysicsStep 16 calls simulate 3 times with 16 and carries 2ms over', async () => {
      const { world: w, physicsWorld } = await makeSteppableWorld({ fixedPhysicsStep: 16 });

      w.worldClock.step(50);

      expect(physicsWorld.simulate).toHaveBeenCalledTimes(3);
      expect(physicsWorld.simulate).toHaveBeenNthCalledWith(1, 16);
      expect(physicsWorld.simulate).toHaveBeenNthCalledWith(2, 16);
      expect(physicsWorld.simulate).toHaveBeenNthCalledWith(3, 16);

      // the leftover 2ms from the first tick carries over - a further 14ms tick brings the
      // accumulator to exactly 16ms, triggering exactly one more substep
      w.worldClock.step(14);
      expect(physicsWorld.simulate).toHaveBeenCalledTimes(4);
    });

    it('caps substeps at maxPhysicsStepsPerTick and drops the remainder instead of carrying it over', async () => {
      const { world: w, physicsWorld } = await makeSteppableWorld({ fixedPhysicsStep: 16, maxPhysicsStepsPerTick: 8 });
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // a 1000ms tick would need 62 steps of 16ms - far more than the 8-step cap
      w.worldClock.step(1000);

      expect(physicsWorld.simulate).toHaveBeenCalledTimes(8);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('maxPhysicsStepsPerTick'));
      warnSpy.mockRestore();

      // the remainder was dropped (not carried): a subsequent 1ms tick doesn't push the
      // accumulator anywhere near another 16ms step
      w.worldClock.step(1);
      expect(physicsWorld.simulate).toHaveBeenCalledTimes(8);
    });

    it('fires tickForwardTo$/tickForwardedTo$("PHYSICS_WORLD") once per tick, not once per substep', async () => {
      const { world: w, physicsWorld } = await makeSteppableWorld({ fixedPhysicsStep: 16 });
      const forwardTo: unknown[] = [];
      const forwardedTo: unknown[] = [];
      w.tickForwardTo$.subscribe(x => forwardTo.push(x));
      w.tickForwardedTo$.subscribe(x => forwardedTo.push(x));

      w.worldClock.step(50); // 3 substeps

      expect(physicsWorld.simulate).toHaveBeenCalledTimes(3);
      expect(forwardTo.filter(x => x === 'PHYSICS_WORLD').length).toBe(1);
      expect(forwardedTo.filter(x => x === 'PHYSICS_WORLD').length).toBe(1);
    });

    it('an entity ticking just before PHYSICS_SIMULATION still ticks exactly once per world tick regardless of substep count', async () => {
      const { world: w } = await makeSteppableWorld({ fixedPhysicsStep: 16 });
      class PrePhysicsEntity extends IEntity {
        readonly tickOrder = TickOrder.PHYSICS_SIMULATION - 5;
      }
      const entity = new PrePhysicsEntity();
      entity.name = 'PrePhysics';
      w.addEntity(entity);
      const tickSpy = jest.fn();
      entity.tick$.subscribe(tickSpy);

      w.worldClock.step(50); // 3 physics substeps this tick

      expect(tickSpy).toHaveBeenCalledTimes(1);
    });
  });
  describe('dispose', () => {
    it('does not start listening to the keyboard again when input is enabled after dispose', () => {
      const disposedWorld = new MockWorld();
      disposedWorld.inputEnabled = false;
      disposedWorld.dispose();
      disposedWorld.inputEnabled = true;
      expect(disposedWorld.keyboardInput.running).toBe(false);
    });

    it('runs every teardown step when one throws, then rethrows that error', () => {
      const failure = new Error('physics dispose failed');
      const failing = new MockWorld({
        physicsWorld: {
          init: async () => {},
          simulate: () => {},
          dispose: () => {
            throw failure;
          },
        },
      });
      const visualDispose = jest.spyOn(failing.visualScene!, 'dispose');
      const entity = new GgEntityMock();
      failing.addEntity(entity);
      const disposed = jest.fn();
      failing.disposed$.subscribe({ complete: disposed });

      expect(() => failing.dispose()).toThrow(failure);
      expect(visualDispose).toHaveBeenCalled();
      expect(entity.disposed).toBe(true);
      expect(disposed).toHaveBeenCalled();
    });
  });
});
