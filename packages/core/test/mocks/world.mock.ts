import { Entity2d, GgWorld } from '../../src';

export class MockWorld extends GgWorld<any, any> {
  constructor() {
    super({
      visualScene: {
        init: async () => {
        },
        dispose: () => {
        },
      } as any,
      physicsWorld: {
        init: async () => {
        },
        simulate: () => {
        },
        dispose: () => {
        },
      } as any,
    });
  }

  addPrimitiveRigidBody(descr: any, position: any, rotation: any): Entity2d {
    return undefined!;
  }

}
