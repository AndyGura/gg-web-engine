import { GgWorld } from '../../../src/base/gg-world';
import { GgEntity, GGTickOrder } from '../../../src';
import { MockWorld } from '../../mocks/world.mock';

describe('GgEntity', () => {
  let ggEntity: GgEntity;
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

  it('should set and get the entity name', () => {
    const newName = 'NewEntity';
    ggEntity.name = newName;
    expect(ggEntity.name).toBe(newName);
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

    ggEntity.onSpawned(ggWorld);
    ggEntity.dispose();

    expect(removeEntitySpy).toHaveBeenCalledWith(ggEntity, false);
    expect(ggEntity.world).toBeNull();
    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });

  // Mock class for GgEntity
  class GgEntityMock extends GgEntity {
    readonly tickOrder: GGTickOrder = GGTickOrder.OBJECTS_BINDING;
  }
});
