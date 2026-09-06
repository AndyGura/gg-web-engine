import { GgWorld, IEntity, RemoveEntityBlueprintNode, TickOrder } from '../../../src';
import { MockWorld } from '../../mocks/world.mock';

class TestEntity extends IEntity {
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;
}

describe('RemoveEntityBlueprintNode', () => {
  let world: GgWorld<any, any>;

  beforeEach(() => {
    world = new MockWorld();
  });

  it('declares one data input pin ("entity") and no output pins', () => {
    const node = new RemoveEntityBlueprintNode(world, {});
    expect(node.inputs).toEqual([{ name: 'entity', kind: 'data' }]);
    expect(node.outputs).toEqual([]);
  });

  it('removes the entity, without disposing it, when triggered and dispose is unset', () => {
    const entity = new TestEntity();
    world.addEntity(entity);
    const removeSpy = jest.spyOn(world, 'removeEntity');

    const node = new RemoveEntityBlueprintNode(world, {});
    node.trigger('entity', entity);

    expect(removeSpy).toHaveBeenCalledWith(entity, false);
    expect(entity.world).toBeNull();
  });

  it('disposes the entity too when the dispose setting is true', () => {
    const entity = new TestEntity();
    world.addEntity(entity);
    const disposeSpy = jest.spyOn(entity, 'dispose');

    const node = new RemoveEntityBlueprintNode(world, { dispose: true });
    node.trigger('entity', entity);

    expect(disposeSpy).toHaveBeenCalled();
  });

  it('ignores triggers on unknown input pins', () => {
    const entity = new TestEntity();
    world.addEntity(entity);
    const removeSpy = jest.spyOn(world, 'removeEntity');

    const node = new RemoveEntityBlueprintNode(world, {});
    node.trigger('somethingElse', entity);

    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('warns and does nothing when triggered without a valid entity reference', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const removeSpy = jest.spyOn(world, 'removeEntity');

    const node = new RemoveEntityBlueprintNode(world, {});
    node.trigger('entity', { notAnEntity: true });

    expect(removeSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'RemoveEntity blueprint node triggered without a valid entity reference - ignoring',
    );

    warnSpy.mockRestore();
  });
});
