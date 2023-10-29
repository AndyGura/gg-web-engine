import { GgWorld } from '../../src/base/gg-world';
import { Entity2d } from '../../src';

export class MockWorld extends GgWorld<any, any> {
  constructor() {
    super(
      {
        dispose: () => {
        },
      } as any,
      {
        dispose: () => {
        },
      } as any);
  }

  addPrimitiveRigidBody(descr: any, position: any, rotation: any): Entity2d {
    return undefined!;
  }

}
