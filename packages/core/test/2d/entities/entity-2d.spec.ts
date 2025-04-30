import { Entity2d } from '../../../src';
import { mock2DBody } from '../../mocks/body.mock';
import { mock2DObject } from '../../mocks/object.mock';

describe(`Entity2d`, () => {

  describe(`constructor`, () => {
    it(`should pull position and rotation from body immediately`, () => {
      const objectBody = mock2DBody();
      objectBody.position = { x: 1, y: 2 };
      objectBody.rotation = 2;
      const entity = new Entity2d({ objectBody });
      expect(entity.position).toEqual({ x: 1, y: 2 });
      expect(entity.rotation).toBe(2);
    });
    it(`should pull position from object immediately if no body`, () => {
      const object2D = mock2DObject();
      object2D.position = { x: 2, y: 3 };
      object2D.rotation = 3;
      const entity = new Entity2d({ object2D });
      expect(entity.position).toEqual({ x: 2, y: 3 });
      expect(entity.rotation).toEqual(3);
    });
    it(`when both object and body defined, should pull and apply position of the body`, () => {
      const object2D = mock2DObject();
      object2D.position = { x: 2, y: 3 };
      object2D.rotation = 3;
      const objectBody = mock2DBody();
      objectBody.position = { x: 1, y: 2 };
      objectBody.rotation = 2;
      const entity = new Entity2d({ object2D, objectBody });
      expect(entity.position).toEqual({ x: 1, y: 2 });
      expect(entity.rotation).toEqual(2);
      expect(object2D.position).toEqual({ x: 1, y: 2 });
      expect(object2D.rotation).toEqual(2);
    });
  });

  describe(`tick`, () => {
    it(`should pull position and rotation from body`, () => {
      const objectBody = mock2DBody();
      const entity = new Entity2d({ objectBody });
      objectBody.position = { x: 4, y: -1 };
      objectBody.rotation = -1;
      expect(entity.position).toEqual({ x: 0, y: 0 });
      expect(entity.rotation).toEqual(0);
      entity.tick$.next([0, 0]);
      expect(entity.position).toEqual({ x: 4, y: -1 });
      expect(entity.rotation).toEqual(-1);
    });
    it(`should pull position and rotation from body and overwrite object transform`, () => {
      const objectBody = mock2DBody();
      const object2D = mock2DObject();
      const entity = new Entity2d({ object2D, objectBody });
      objectBody.position = { x: 4, y: -1 };
      objectBody.rotation = -1;
      object2D.position = { x: 1, y: 3 };
      object2D.rotation = -5;
      expect(entity.position).toEqual({ x: 0, y: 0 });
      expect(entity.rotation).toEqual(0);
      entity.tick$.next([0, 0]);
      expect(entity.position).toEqual({ x: 4, y: -1 });
      expect(entity.rotation).toEqual(-1);
      expect(object2D.position).toEqual({ x: 4, y: -1 });
      expect(object2D.rotation).toEqual(-1);
    });
  });

  describe(`dispose`, () => {
    it(`should not fail if disposing twice (happens for sub-entities when disposing whole world)`, () => {
      const objectBody = mock2DBody();
      const entity = new Entity2d({ objectBody });
      entity.dispose();
      expect(() => entity.dispose()).not.toThrow(Error);
    });
  });
});
