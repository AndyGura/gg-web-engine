import { Entity2d, GgWorld } from '../../src';

export class MockWorld extends GgWorld<any, any> {
  constructor(args: { maxTickDelta?: number; pauseWhenHidden?: boolean } = {}) {
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
      ...args,
    });
  }

  addPrimitiveRigidBody(descr: any, position: any, rotation: any): Entity2d {
    return undefined!;
  }

}
