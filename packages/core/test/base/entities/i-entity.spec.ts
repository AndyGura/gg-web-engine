import { GgWorld } from '../../../src/base/gg-world';
import { IEntity, TickOrder } from '../../../src';
import { MockWorld } from '../../mocks/world.mock';

describe('IEntity', () => {
  let ggEntity: IEntity;
  let ggWorld: GgWorld<any, any>;

  beforeEach(() => {
    ggEntity = new GgEntityMock();
    ggWorld = new MockWorld();
  });

  afterEach(() => {
    ggEntity.dispose();
  });

  it('should have a default tickOrder', () => {
    expect(ggEntity.tickOrder).toBeDefined();
  });

  it('should have an active state', () => {
    expect(ggEntity.active).toBe(true);
  });

  it('should propagate active state', () => {
    const child = new GgEntityMock();
    ggEntity.addChildren(child);
    expect(ggEntity.active).toBe(true);
    expect(child.active).toBe(true);
    ggEntity.active = false;
    expect(child.active).toBe(false);
    ggEntity.active = true;
    expect(child.active).toBe(true);
    child.active = false;
    ggEntity.active = false;
    ggEntity.active = true;
    expect(child.active).toBe(false);
  });

  it('should set and get the entity name', () => {
    const newName = 'NewEntity';
    ggEntity.name = newName;
    expect(ggEntity.name).toBe(newName);
  });

  describe('useDefaultNameMiddleware', () => {
    afterEach(() => {
      // middlewares are process-global and would otherwise leak into every later test in this file
      (IEntity as any).defaultNameMiddlewares = [];
    });

    it('applies a registered middleware to every subsequently-constructed entity default name', () => {
      IEntity.useDefaultNameMiddleware(name => `peer1:${name}`);

      const entity = new GgEntityMock();

      expect(entity.name).toMatch(/^peer1:e0x[0-9a-f]+$/);
    });

    it('chains multiple middlewares in registration order', () => {
      IEntity.useDefaultNameMiddleware(name => `a(${name})`);
      IEntity.useDefaultNameMiddleware(name => `b(${name})`);

      const entity = new GgEntityMock();

      expect(entity.name).toMatch(/^b\(a\(e0x[0-9a-f]+\)\)$/);
    });

    it('never touches a name explicitly assigned afterward', () => {
      IEntity.useDefaultNameMiddleware(name => `peer1:${name}`);

      const entity = new GgEntityMock();
      entity.name = 'Explicit';

      expect(entity.name).toBe('Explicit');
    });
  });

  describe('entityTypeName-based default naming', () => {
    afterEach(() => {
      // middlewares and per-type counters are process-global and would otherwise leak into every
      // later test in this file
      (IEntity as any).defaultNameMiddlewares = [];
      (IEntity as any).defaultNameCountersByType = new Map();
    });

    it('uses "${entityTypeName}_${n}" instead of the opaque default when the class declares one', () => {
      const a = new TaggedEntityMock();
      const b = new TaggedEntityMock();

      expect(a.name).toBe('TaggedEntityMock_0');
      expect(b.name).toBe('TaggedEntityMock_1');
    });

    it('scopes the counter per entityTypeName, not globally', () => {
      const a = new TaggedEntityMock();
      const c = new OtherTaggedEntityMock();

      expect(a.name).toBe('TaggedEntityMock_0');
      expect(c.name).toBe('OtherTaggedEntityMock_0');
    });

    it('falls back to a parent class entityTypeName when a subclass declares none of its own', () => {
      const entity = new UntaggedSubclassOfTaggedMock();

      expect(entity.name).toBe('TaggedEntityMock_0');
    });

    it('still runs default-name middlewares on top of an entityTypeName-derived name', () => {
      IEntity.useDefaultNameMiddleware(name => `peer1:${name}`);

      const entity = new TaggedEntityMock();

      expect(entity.name).toBe('peer1:TaggedEntityMock_0');
    });

    class TaggedEntityMock extends IEntity {
      static readonly entityTypeName: string = 'TaggedEntityMock';
      readonly tickOrder = TickOrder.OBJECTS_BINDING;
    }

    class OtherTaggedEntityMock extends IEntity {
      static readonly entityTypeName: string = 'OtherTaggedEntityMock';
      readonly tickOrder = TickOrder.OBJECTS_BINDING;
    }

    class UntaggedSubclassOfTaggedMock extends TaggedEntityMock {}
  });

  it('should add children entities', () => {
    const child1 = new GgEntityMock();
    const child2 = new GgEntityMock();

    ggEntity.addChildren(child1, child2);

    expect(child1.parent).toBe(ggEntity);
    expect(child2.parent).toBe(ggEntity);
    expect(ggEntity['_children']).toContain(child1);
    expect(ggEntity['_children']).toContain(child2);
  });

  it('should remove children entities', () => {
    const child1 = new GgEntityMock();
    const child2 = new GgEntityMock();

    ggEntity.addChildren(child1, child2);

    ggEntity.removeChildren([child1]);

    expect(child1.parent).toBeNull();
    expect(child2.parent).toBe(ggEntity);
    expect(ggEntity['_children']).not.toContain(child1);
    expect(ggEntity['_children']).toContain(child2);
  });

  it('should remove children from old parent', () => {
    const child = new GgEntityMock();
    const parentA = new GgEntityMock();
    const parentB = new GgEntityMock();
    parentA.addChildren(child);
    expect(child.parent).toBe(parentA);
    expect(parentA['_children']).toContain(child);
    parentB.addChildren(child);
    expect(child.parent).toBe(parentB);
    expect(parentB['_children']).toContain(child);
    expect(parentA['_children']).not.toContain(child);
  });

  it('should find a direct child by name', () => {
    const child = new GgEntityMock();
    child.name = 'Child';
    ggEntity.addChildren(child);

    expect(ggEntity.getChildEntityByName('Child')).toBe(child);
  });

  it('should find a grandchild by name, searching recursively', () => {
    const child = new GgEntityMock();
    const grandchild = new GgEntityMock();
    grandchild.name = 'Grandchild';
    child.addChildren(grandchild);
    ggEntity.addChildren(child);

    expect(ggEntity.getChildEntityByName('Grandchild')).toBe(grandchild);
  });

  it('should throw when no descendant has the given name', () => {
    ggEntity.name = 'Root';
    expect(() => ggEntity.getChildEntityByName('Nope')).toThrow('No child entity named "Nope" found under "Root"');
  });

  it('should not find itself via getChildEntityByName, only descendants', () => {
    ggEntity.name = 'Self';
    expect(() => ggEntity.getChildEntityByName('Self')).toThrow('No child entity named "Self" found under "Self"');
  });

  it('should trigger onSpawned event', () => {
    const onSpawnedSpy = jest.spyOn(ggEntity['_onSpawned$'], 'next');

    ggEntity.onSpawned(ggWorld);

    expect(ggEntity.world).toBe(ggWorld);
    expect(onSpawnedSpy).toHaveBeenCalledTimes(1);
  });

  it('should trigger onRemoved event', () => {
    const onRemovedSpy = jest.spyOn(ggEntity['_onRemoved$'], 'next');

    ggEntity.onRemoved();

    expect(ggEntity.world).toBeNull();
    expect(onRemovedSpy).toHaveBeenCalledTimes(1);
  });

  it('should dispose the entity', () => {
    const removeEntitySpy = jest.spyOn(ggWorld, 'removeEntity');
    const disposeSpy = jest.spyOn(ggEntity, 'dispose');

    expect(ggEntity.disposed).toBe(false);
    ggEntity.onSpawned(ggWorld);
    ggEntity.dispose();

    expect(removeEntitySpy).toHaveBeenCalledWith(ggEntity, false);
    expect(ggEntity.world).toBeNull();
    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(ggEntity.disposed).toBe(true);
  });

  it('should be idempotent - a second dispose() call does not dispose components/children again', () => {
    // regression test: a component's own dispose() often frees a native handle with no guard
    // against being called twice (see e.g. AmmoRaycastVehicleComponent before this fix) - and
    // Gg3dWorld.removeEntity(entity, true) calls entity.dispose() unconditionally whenever
    // `dispose` is true, even if the entity was already removed/disposed. Without an idempotency
    // guard on IEntity.dispose() itself, anything that can end up calling removeEntity(sameEntity,
    // true) twice (e.g. a trigger reacting to the same body leaving via two different paths) would
    // double-dispose every one of that entity's components.
    const component = {
      entity: null,
      addToWorld: jest.fn(),
      removeFromWorld: jest.fn(),
      dispose: jest.fn(),
    };
    const child = new GgEntityMock();
    const childDisposeSpy = jest.spyOn(child, 'dispose');
    ggEntity.addComponents(component as any);
    ggEntity.addChildren(child);

    ggEntity.dispose();
    ggEntity.dispose();

    expect(component.dispose).toHaveBeenCalledTimes(1);
    expect(childDisposeSpy).toHaveBeenCalledTimes(1);
  });

  // Mock class for GgEntity
  class GgEntityMock extends IEntity {
    readonly tickOrder: TickOrder = TickOrder.OBJECTS_BINDING;
  }
});
