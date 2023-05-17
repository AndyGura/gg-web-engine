import { GgWorld } from '../../src/base/gg-world';
import { GgPositionableEntity } from '../../src/base/entities/gg-positionable-entity';

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

  addPrimitiveRigidBody(descr: any, position: any, rotation: any): GgPositionableEntity<any, any> {
    return undefined!;
  }

}
