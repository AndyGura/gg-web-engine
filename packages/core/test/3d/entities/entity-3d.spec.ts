import { AnimationMixer, Entity3d } from '../../../src';
import { mock3DBody } from '../../mocks/body.mock';
import { mock3DObject } from '../../mocks/object.mock';

describe(`Entity3d`, () => {

  describe(`constructor`, () => {
    it(`should pull position and rotation from body immediately`, () => {
      const objectBody = mock3DBody();
      objectBody.position = { x: 1, y: 2, z: 3 };
      objectBody.rotation = { x: 4, y: -1, z: 2, w: 3 };
      const entity = new Entity3d({ objectBody });
      expect(entity.position).toEqual({ x: 1, y: 2, z: 3 });
      expect(entity.rotation).toEqual({ x: 4, y: -1, z: 2, w: 3 });
    });
    it(`should pull position from object immediately if no body`, () => {
      const object3D = mock3DObject();
      object3D.position = { x: 1, y: 3, z: 2 };
      object3D.rotation = { x: -1, y: 0, z: 1, w: 2 };
      const entity = new Entity3d({ object3D });
      expect(entity.position).toEqual({ x: 1, y: 3, z: 2 });
      expect(entity.rotation).toEqual({ x: -1, y: 0, z: 1, w: 2 });
    });
    it(`when both object and body defined, should pull and apply position of the body`, () => {
      const object3D = mock3DObject();
      object3D.position = { x: 1, y: 3, z: 2 };
      object3D.rotation = { x: -1, y: 0, z: 1, w: 2 };
      const objectBody = mock3DBody();
      objectBody.position = { x: 1, y: 2, z: 3 };
      objectBody.rotation = { x: 4, y: -1, z: 2, w: 3 };
      const entity = new Entity3d({ object3D, objectBody });
      expect(entity.position).toEqual({ x: 1, y: 2, z: 3 });
      expect(entity.rotation).toEqual({ x: 4, y: -1, z: 2, w: 3 });
      expect(object3D.position).toEqual({ x: 1, y: 2, z: 3 });
      expect(object3D.rotation).toEqual({ x: 4, y: -1, z: 2, w: 3 });
    });
  });

  describe(`tick`, () => {
    it(`should pull position and rotation from body`, () => {
      const objectBody = mock3DBody();
      const entity = new Entity3d({ objectBody });
      objectBody.position = { x: 4, y: -1, z: 0 };
      objectBody.rotation = { x: 2, y: 3, z: 1, w: -5 };
      expect(entity.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(entity.rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
      entity.tick$.next([0, 0]);
      expect(entity.position).toEqual({ x: 4, y: -1, z: 0 });
      expect(entity.rotation).toEqual({ x: 2, y: 3, z: 1, w: -5 });
    });
    it(`should pull position and rotation from body and overwrite object transform`, () => {
      const objectBody = mock3DBody();
      const object3D = mock3DObject();
      const entity = new Entity3d({ object3D, objectBody });
      objectBody.position = { x: 4, y: -1, z: 0 };
      objectBody.rotation = { x: 2, y: 3, z: 1, w: -5 };
      object3D.position = { x: 1, y: 3, z: 2 };
      object3D.rotation = { x: -1, y: 0, z: 1, w: 2 };
      expect(entity.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(entity.rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
      entity.tick$.next([0, 0]);
      expect(entity.position).toEqual({ x: 4, y: -1, z: 0 });
      expect(entity.rotation).toEqual({ x: 2, y: 3, z: 1, w: -5 });
      expect(object3D.position).toEqual({ x: 4, y: -1, z: 0 });
      expect(object3D.rotation).toEqual({ x: 2, y: 3, z: 1, w: -5 });
    });
  });

  describe(`dispose`, () => {
    it(`should not fail if disposing twice (happens for sub-entities when disposing whole world)`, () => {
      const objectBody = mock3DBody();
      const entity = new Entity3d({ objectBody });
      entity.dispose();
      expect(() => entity.dispose()).not.toThrow(Error);
    });
  });

  describe('visible', () => {
    test('should set the visible property', () => {
      const gg3dEntity = new Entity3d({ object3D: mock3DObject() });
      gg3dEntity.visible = false;
      expect(gg3dEntity.visible).toBe(false);
    });

    test('should update visibility', () => {
      const gg3dEntity = new Entity3d({ object3D: mock3DObject() });
      gg3dEntity.visible = false;
      gg3dEntity.updateVisibility();
      expect(gg3dEntity.object3D!.visible).toBe(false);
    });
  });

  describe('worldVisible', () => {
    test('should return true when all parent entities are visible', () => {
      // Mock parent entities
      const parentEntity1 = { visible: true, parent: null } as any;
      const parentEntity2 = { visible: true, parent: parentEntity1 } as any;
      const parentEntity3 = { visible: true, parent: parentEntity2 } as any;

      const gg3dEntity = new Entity3d({ object3D: mock3DObject() });
      gg3dEntity.parent = parentEntity3;
      expect(gg3dEntity.worldVisible).toBe(true);
    });

    test('should return false when any parent entity is not visible', () => {
      const parentEntity1 = { visible: true, parent: null } as any;
      const parentEntity2 = { visible: false, parent: parentEntity1 } as any;
      const parentEntity3 = { visible: true, parent: parentEntity2 } as any;

      const gg3dEntity = new Entity3d({ object3D: mock3DObject() });
      gg3dEntity.parent = parentEntity3;
      expect(gg3dEntity.worldVisible).toBe(false);
    });
  });

  describe('updateVisibility', () => {
    test('should update object3D visibility when worldVisible is true', () => {
      const gg3dEntity = new Entity3d({ object3D: mock3DObject() });
      gg3dEntity.visible = true;
      gg3dEntity.updateVisibility();
      expect(gg3dEntity.object3D!.visible).toBe(true);
    });

    test('should not update object3D visibility when worldVisible is false', () => {
      const gg3dEntity = new Entity3d({ object3D: mock3DObject() });
      gg3dEntity.visible = false;
      gg3dEntity.updateVisibility();
      expect(gg3dEntity.object3D!.visible).toBe(false);
    });

    test('should update visibility of children', () => {
      const a = new Entity3d({ object3D: mock3DObject() });
      const b = new Entity3d({ object3D: mock3DObject() });
      const gg3dEntity = new Entity3d({ object3D: mock3DObject() });
      a.addChildren(b);
      b.addChildren(gg3dEntity);
      expect(gg3dEntity.object3D!.visible).toBe(true);

      a.visible = false;
      expect(gg3dEntity.object3D!.visible).toBe(false);
    });

    test('should update visibility of children even if intermediate child is not renderable', () => {
      const a = new Entity3d({ object3D: mock3DObject() });
      const b = new AnimationMixer(null!);
      const c = new Entity3d({ object3D: mock3DObject() });
      const gg3dEntity = new Entity3d({ object3D: mock3DObject() });
      a.addChildren(b);
      b.addChildren(c);
      c.addChildren(gg3dEntity);
      expect(gg3dEntity.object3D!.visible).toBe(true);

      a.visible = false;
      expect(gg3dEntity.object3D!.visible).toBe(false);
    });

    test('should be called when adding as child to entity', () => {
      const a = new Entity3d({ object3D: mock3DObject() });
      const gg3dEntity = new Entity3d({ object3D: mock3DObject() });
      const call = jest.spyOn(gg3dEntity, 'updateVisibility');
      a.addChildren(gg3dEntity);
      expect(call).toHaveBeenCalledTimes(1);
    });

    test('should be called when adding own parent as child to entity', () => {
      const a = new Entity3d({ object3D: mock3DObject() });
      const b = new Entity3d({ object3D: mock3DObject() });
      const gg3dEntity = new Entity3d({ object3D: mock3DObject() });
      b.addChildren(gg3dEntity);
      const call = jest.spyOn(gg3dEntity, 'updateVisibility');
      a.addChildren(b);
      expect(call).toHaveBeenCalledTimes(1);
    });

    test('should be called when adding own non-renderable parent as child to entity', () => {
      const a = new Entity3d({ object3D: mock3DObject() });
      const b = new AnimationMixer(null!);
      const gg3dEntity = new Entity3d({ object3D: mock3DObject() });
      b.addChildren(gg3dEntity);
      const call = jest.spyOn(gg3dEntity, 'updateVisibility');
      a.addChildren(b);
      expect(call).toHaveBeenCalledTimes(1);
    });

    test('should be called when removing as child from entity', () => {
      const a = new Entity3d({ object3D: mock3DObject() });
      const gg3dEntity = new Entity3d({ object3D: mock3DObject() });
      a.addChildren(gg3dEntity);
      const call = jest.spyOn(gg3dEntity, 'updateVisibility');
      a.removeChildren([gg3dEntity]);
      expect(call).toHaveBeenCalledTimes(1);
    });
  });
});
