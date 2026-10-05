import { Entity3d, Gg3dLoader, Gg3dWorld, GroupEntity, IEntity, LevelJson, TickOrder } from '../../src';
import { LoadResourcesResult, LoadResultWithProps } from '../../src/3d/loader';
import { mock3DBody } from '../mocks/body.mock';
import { mock3DObject } from '../mocks/object.mock';

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
    // the "Glb" class declares its file as a level asset; these specs mock loadGgGlb, not the fetch
    jest.spyOn(loader, 'preload').mockResolvedValue();
  });

  it('exposes level-loading directly on the loader', () => {
    expect(typeof loader.registerClass).toBe('function');
    expect(typeof loader.loadLevel).toBe('function');
    expect(typeof loader.loadLevelFromUrl).toBe('function');
  });

  describe('"Glb" level entity class', () => {
    it('throws when path is missing', async () => {
      const levelJson: LevelJson = { entities: [{ class: 'Glb', config: {} }] };
      await expect(loader.loadLevel(levelJson, 'TestLevel')).rejects.toThrow('Path is required for Glb class');
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

      const level = await loader.loadLevel(levelJson, 'TestLevel');

      expect(loadGgGlbSpy).toHaveBeenCalledWith(
        'assets/my-model',
        expect.objectContaining({ position: { x: 1, y: 2, z: 3 }, loadProps: true, nameScope: 'MyModel' }),
      );

      const group = level.getChildEntityByName<GroupEntity>('MyModel');
      expect(group).toBeInstanceOf(GroupEntity);
      expect(group.children).toEqual([model, prop, nestedProp]);
      expect(model.parent).toBe(group);
      expect(prop.parent).toBe(group);
      expect(nestedProp.parent).toBe(group);
    });

    it('scopes the produced entities under the level-derived fallback name when the entry has no name', async () => {
      const loadGgGlbSpy = jest
        .spyOn(loader, 'loadGgGlb')
        .mockResolvedValue({ entities: [new FakeEntity3d()], meta: {} as any } as unknown as LoadResultWithProps);

      await loader.loadLevel({ entities: [{ class: 'Glb', config: { path: 'assets/m' } }] }, 'TestLevel');

      expect(loadGgGlbSpy).toHaveBeenCalledWith('assets/m', expect.objectContaining({ nameScope: 'TestLevel__Glb_0' }));
    });

    it('passes an explicit config.nameScope (including null) through untouched', async () => {
      const loadGgGlbSpy = jest
        .spyOn(loader, 'loadGgGlb')
        .mockResolvedValue({ entities: [new FakeEntity3d()], meta: {} as any } as unknown as LoadResultWithProps);

      await loader.loadLevel(
        {
          entities: [
            { class: 'Glb', name: 'A', config: { path: 'assets/m', nameScope: 'Custom' } },
            { class: 'Glb', name: 'B', config: { path: 'assets/m', nameScope: null } },
          ],
        },
        'TestLevel',
      );

      expect(loadGgGlbSpy).toHaveBeenNthCalledWith(1, 'assets/m', expect.objectContaining({ nameScope: 'Custom' }));
      expect(loadGgGlbSpy).toHaveBeenNthCalledWith(2, 'assets/m', expect.objectContaining({ nameScope: null }));
    });
    it('passes castShadow/receiveShadow through to loadGgGlb', async () => {
      const loadGgGlbSpy = jest
        .spyOn(loader, 'loadGgGlb')
        .mockResolvedValue({ entities: [new FakeEntity3d()], meta: {} as any } as unknown as LoadResultWithProps);

      await loader.loadLevel(
        { entities: [{ class: 'Glb', name: 'A', config: { path: 'assets/m', castShadow: true, receiveShadow: false } }] },
        'TestLevel',
      );

      expect(loadGgGlbSpy).toHaveBeenCalledWith(
        'assets/m',
        expect.objectContaining({ castShadow: true, receiveShadow: false, nameScope: 'A' }),
      );
    });
  });

  describe('loadGgGlb entity naming', () => {
    // one model made of two named bodies plus a body-less leftover root, and one prop dummy
    const resourcesFor = (suffix: string, dummies: any[] = []): LoadResourcesResult => {
      const named = (name: string) => {
        const body = mock3DBody();
        body.name = name;
        return { object3D: mock3DObject(), body };
      };
      const leftover = mock3DObject();
      (leftover as any).name = '';
      return {
        resources: [named(`Suzanne${suffix}`), named(`Floor${suffix}`), { object3D: leftover, body: null }],
        meta: { dummies } as any,
      };
    };

    beforeEach(() => {
      jest.spyOn(loader, 'loadGgGlbResources').mockImplementation(async (path: string) => {
        if (path === 'assets/scene') {
          return resourcesFor('', [
            { name: 'RadioSpot', is_prop: true, prop_id: 'radio', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
          ]);
        }
        return resourcesFor('_prop');
      });
    });

    it('names every entity (and, recursively, every prop entity) under an explicit nameScope', async () => {
      const result = await loader.loadGgGlb('assets/scene', { nameScope: 'Room' });

      expect(result.entities.map(e => e.name)).toEqual(['Room__Suzanne', 'Room__Floor', 'Room__2']);
      expect(result.props![0].entities.map(e => e.name)).toEqual([
        'Room__RadioSpot__Suzanne_prop',
        'Room__RadioSpot__Floor_prop',
        'Room__RadioSpot__2',
      ]);
      expect(result.entities[0]).toBeInstanceOf(Entity3d);
    });

    it('generates a fresh, unique scope per load by default, so repeated loads never collide', async () => {
      const first = await loader.loadGgGlb('assets/scene', { loadProps: false });
      const second = await loader.loadGgGlb('assets/scene', { loadProps: false });

      expect(first.entities[0].name).toMatch(/^glb_\d+__Suzanne$/);
      expect(second.entities[0].name).toMatch(/^glb_\d+__Suzanne$/);
      expect(first.entities[0].name).not.toBe(second.entities[0].name);
      const names = [...first.entities, ...second.entities].map(e => e.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it("falls back to the index, not object3D's name, for a resource whose body exists but is unnamed - matching Entity3d's own constructor, which never reaches past a present objectBody for object3D.name", async () => {
      const body = mock3DBody();
      body.name = '';
      const object3D = mock3DObject();
      (object3D as any).name = 'SomeMeshName';
      jest.spyOn(loader, 'loadGgGlbResources').mockResolvedValueOnce({
        resources: [{ object3D, body }],
        meta: { dummies: [] } as any,
      });

      const result = await loader.loadGgGlb('assets/scene', { nameScope: 'Room', loadProps: false });

      expect(result.entities[0].name).toBe('Room__0');
    });

    it('keeps the raw native object names when nameScope is null, props included', async () => {
      const result = await loader.loadGgGlb('assets/scene', { nameScope: null });

      expect(result.entities.map(e => e.name)).toEqual(['Suzanne', 'Floor', 'Entity3d_' + result.entities[2].name.split('_')[1]]);
      expect(result.entities[2].name).toMatch(/^Entity3d_\d+$/);
      expect(result.props![0].entities.map(e => e.name).slice(0, 2)).toEqual(['Suzanne_prop', 'Floor_prop']);
    });
  });

  describe('loadGgGlb shadows', () => {
    beforeEach(() => {
      jest.spyOn(loader, 'loadGgGlbResources').mockImplementation(async (path: string) => ({
        resources: [{ object3D: mock3DObject(), body: null }],
        meta: {
          dummies:
            path === 'assets/scene'
              ? [{ name: 'Spot', is_prop: true, prop_id: 'prop', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }]
              : [],
        } as any,
      }));
    });

    it('applies castShadow/receiveShadow to every loaded display object, props included', async () => {
      const result = await loader.loadGgGlb('assets/scene', { castShadow: true, receiveShadow: true });

      for (const entity of [...result.entities, ...result.props![0].entities]) {
        expect(entity.object3D!.castShadow).toBe(true);
        expect(entity.object3D!.receiveShadow).toBe(true);
      }
    });

    it('leaves shadows as loaded when the options are omitted', async () => {
      const result = await loader.loadGgGlb('assets/scene');

      expect(result.entities[0].object3D!.castShadow).toBeUndefined();
      expect(result.entities[0].object3D!.receiveShadow).toBeUndefined();
    });
  });
});
