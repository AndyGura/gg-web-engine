import { GgWorld } from '../../src/base/gg-world';
import { Gg2dEntity } from '../../src';

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

  addPrimitiveRigidBody(descr: any, position: any, rotation: any): Gg2dEntity {
    return undefined!;
  }

}
