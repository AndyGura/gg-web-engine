import { Entity2d } from '../../../src';
import { mock2DBody } from '../../mocks/body.mock';
import { mock2DObject } from '../../mocks/object.mock';

describe(`Entity2d`, () => {

  describe(`constructor`, () => {
    it(`should pull position and rotation from body immediately`, () => {
      const body = mock2DBody();
      body.position = { x: 1, y: 2 };
      body.rotation = 2;
      const entity = new Entity2d(null, body);
      expect(entity.position).toEqual({ x: 1, y: 2 });
      expect(entity.rotation).toBe(2);
    });
    it(`should pull position from object immediately if no body`, () => {
      const object = mock2DObject();
      object.position = { x: 2, y: 3 };
      object.rotation = 3;
      const entity = new Entity2d(object, null);
      expect(entity.position).toEqual({ x: 2, y: 3 });
      expect(entity.rotation).toEqual(3);
    });
    it(`when both object and body defined, should pull and apply position of the body`, () => {
      const object = mock2DObject();
      object.position = { x: 2, y: 3 };
      object.rotation = 3;
      const body = mock2DBody();
      body.position = { x: 1, y: 2 };
      body.rotation = 2;
      const entity = new Entity2d(object, body);
      expect(entity.position).toEqual({ x: 1, y: 2 });
      expect(entity.rotation).toEqual(2);
      expect(object.position).toEqual({ x: 1, y: 2 });
      expect(object.rotation).toEqual(2);
    });
  });

  describe(`tick`, () => {
    it(`should pull position and rotation from body`, () => {
      const body = mock2DBody();
      const entity = new Entity2d(null, body);
      body.position = { x: 4, y: -1 };
      body.rotation = -1;
      expect(entity.position).toEqual({ x: 0, y: 0 });
      expect(entity.rotation).toEqual(0);
      entity.tick$.next([0, 0]);
      expect(entity.position).toEqual({ x: 4, y: -1 });
      expect(entity.rotation).toEqual(-1);
    });
    it(`should pull position and rotation from body and overwrite object transform`, () => {
      const body = mock2DBody();
      const object = mock2DObject();
      const entity = new Entity2d(object, body);
      body.position = { x: 4, y: -1 };
      body.rotation = -1;
      object.position = { x: 1, y: 3 };
      object.rotation = -5;
      expect(entity.position).toEqual({ x: 0, y: 0 });
      expect(entity.rotation).toEqual(0);
      entity.tick$.next([0, 0]);
      expect(entity.position).toEqual({ x: 4, y: -1 });
      expect(entity.rotation).toEqual(-1);
      expect(object.position).toEqual({ x: 4, y: -1 });
      expect(object.rotation).toEqual(-1);
    });
  });

  describe(`dispose`, () => {
    it(`should not fail if disposing twice (happens for sub-entities when disposing whole world)`, () => {
      const body = mock2DBody();
      const entity = new Entity2d(null, body);
      entity.dispose();
      expect(() => entity.dispose()).not.toThrow(Error);
    });
  });
});
