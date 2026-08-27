import { Gg3dLoader, Gg3dWorld, GroupEntity, IEntity, LevelJson, TickOrder } from '../../src';
import { LoadResultWithProps } from '../../src/3d/loader';

class FakeEntity3d extends IEntity {
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;
}

describe('Gg3dLoader', () => {
  let world: Gg3dWorld;
  let loader: Gg3dLoader;

  beforeEach(() => {
    world = {
      addEntity: jest.fn(),
      removeEntity: jest.fn(),
    } as unknown as Gg3dWorld;

    loader = new Gg3dLoader(world);
  });

  it('exposes level-loading directly on the loader', () => {
    expect(typeof loader.registerClass).toBe('function');
    expect(typeof loader.loadLevel).toBe('function');
    expect(typeof loader.loadLevelFromUrl).toBe('function');
  });

  describe('"Glb" level entity class', () => {
    it('throws when path is missing', async () => {
      const levelJson: LevelJson = { entities: [{ class: 'Glb', config: {} }] };
      await expect(loader.loadLevel(levelJson)).rejects.toThrow('Path is required for Glb class');
    });

    it('loads a GLB, groups every entity it produces (including nested props) under one GroupEntity', async () => {
      const model = new FakeEntity3d();
      const prop = new FakeEntity3d();
      const nestedProp = new FakeEntity3d();
      const mockResult = {
        entities: [model],
        meta: {} as any,
        props: [
          {
            entities: [prop],
            meta: {} as any,
            props: [{ entities: [nestedProp], meta: {} as any }],
          },
        ],
      } as unknown as LoadResultWithProps;
      const loadGgGlbSpy = jest.spyOn(loader, 'loadGgGlb').mockResolvedValue(mockResult);

      const levelJson: LevelJson = {
        entities: [
          {
            class: 'Glb',
            name: 'MyModel',
            position: { x: 1, y: 2, z: 3 },
            config: { path: 'assets/my-model', loadProps: true },
          },
        ],
      };

      const level = await loader.loadLevel(levelJson);

      expect(loadGgGlbSpy).toHaveBeenCalledWith('assets/my-model', {
        position: { x: 1, y: 2, z: 3 },
        loadProps: true,
      });

      const group = level.getChildEntityByName<GroupEntity>('MyModel');
      expect(group).toBeInstanceOf(GroupEntity);
      expect(group.children).toEqual([model, prop, nestedProp]);
      expect(model.parent).toBe(group);
      expect(prop.parent).toBe(group);
      expect(nestedProp.parent).toBe(group);
    });
  });
});
