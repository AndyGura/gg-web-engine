import { Entity3d, GgWorld, IEntity, IRendererEntity, TickOrder } from '../../src';
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
        await expect(commands.get('entity')!()).rejects.toThrow('usage: entity <name>');
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
        await expect(commands.get('remove')!()).rejects.toThrow('usage: remove <name>');
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
});
