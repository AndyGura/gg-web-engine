import { Gg3dEntity } from '../../../src';
import { mock3DBody } from '../../mocks/body.mock';
import { mock3DObject } from '../../mocks/object.mock';

describe(`Gg3dEntity`, () => {

  describe(`constructor`, () => {
    it(`should pull position and rotation from body immediately`, () => {
      const body = mock3DBody();
      body.position = { x: 1, y: 2, z: 3 };
      body.rotation = { x: 4, y: -1, z: 2, w: 3 };
      const entity = new Gg3dEntity(null, body);
      expect(entity.position).toEqual({ x: 1, y: 2, z: 3 });
      expect(entity.rotation).toEqual({ x: 4, y: -1, z: 2, w: 3 });
    });
    it(`should pull position from object immediately if no body`, () => {
      const object = mock3DObject();
      object.position = { x: 1, y: 3, z: 2 };
      object.rotation = { x: -1, y: 0, z: 1, w: 2 };
      const entity = new Gg3dEntity(object, null);
      expect(entity.position).toEqual({ x: 1, y: 3, z: 2 });
      expect(entity.rotation).toEqual({ x: -1, y: 0, z: 1, w: 2 });
    });
    it(`when both object and body defined, should pull and apply position of the body`, () => {
      const object = mock3DObject();
      object.position = { x: 1, y: 3, z: 2 };
      object.rotation = { x: -1, y: 0, z: 1, w: 2 };
      const body = mock3DBody();
      body.position = { x: 1, y: 2, z: 3 };
      body.rotation = { x: 4, y: -1, z: 2, w: 3 };
      const entity = new Gg3dEntity(object, body);
      expect(entity.position).toEqual({ x: 1, y: 2, z: 3 });
      expect(entity.rotation).toEqual({ x: 4, y: -1, z: 2, w: 3 });
      expect(object.position).toEqual({ x: 1, y: 2, z: 3 });
      expect(object.rotation).toEqual({ x: 4, y: -1, z: 2, w: 3 });
    });
  });

  describe(`tick`, () => {
    it(`should pull position and rotation from body`, () => {
      const body = mock3DBody();
      const entity = new Gg3dEntity(null, body);
      body.position = { x: 4, y: -1, z: 0 };
      body.rotation = { x: 2, y: 3, z: 1, w: -5 };
      expect(entity.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(entity.rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
      entity.tick$.next([0, 0]);
      expect(entity.position).toEqual({ x: 4, y: -1, z: 0 });
      expect(entity.rotation).toEqual({ x: 2, y: 3, z: 1, w: -5 });
    });
    it(`should pull position and rotation from body and overwrite object transform`, () => {
      const body = mock3DBody();
      const object = mock3DObject();
      const entity = new Gg3dEntity(object, body);
      body.position = { x: 4, y: -1, z: 0 };
      body.rotation = { x: 2, y: 3, z: 1, w: -5 };
      object.position = { x: 1, y: 3, z: 2 };
      object.rotation = { x: -1, y: 0, z: 1, w: 2 };
      expect(entity.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(entity.rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
      entity.tick$.next([0, 0]);
      expect(entity.position).toEqual({ x: 4, y: -1, z: 0 });
      expect(entity.rotation).toEqual({ x: 2, y: 3, z: 1, w: -5 });
      expect(object.position).toEqual({ x: 4, y: -1, z: 0 });
      expect(object.rotation).toEqual({ x: 2, y: 3, z: 1, w: -5 });
    });
  });

  describe(`dispose`, () => {
    it(`should not fail if disposing twice (happens for sub-entities when disposing whole world)`, () => {
      const body = mock3DBody();
      const entity = new Gg3dEntity(null, body);
      entity.dispose();
      expect(() => entity.dispose()).not.toThrow(Error);
    });
  });
});
