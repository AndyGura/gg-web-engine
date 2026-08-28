import { GgWorld, IEntity, TickOrder } from '../../src';
import { MockWorld } from '../mocks/world.mock';

class GgEntityMock extends IEntity {
  readonly tickOrder: TickOrder = TickOrder.OBJECTS_BINDING;
}

describe('GgWorld', () => {
  let world: GgWorld<any, any>;

  beforeEach(() => {
    world = new MockWorld();
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
});
