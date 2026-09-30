import { Entity2d, GgWorld } from '../../src';

export class MockWorld extends GgWorld<any, any> {
  constructor(args?: { physicsWorld?: any; fixedPhysicsStep?: number; maxPhysicsStepsPerTick?: number }) {
    super({
      visualScene: {
        init: async () => {
        },
        dispose: () => {
        },
      } as any,
      physicsWorld: args?.physicsWorld ?? ({
        init: async () => {
        },
        simulate: () => {
        },
        dispose: () => {
        },
      } as any),
      fixedPhysicsStep: args?.fixedPhysicsStep,
      maxPhysicsStepsPerTick: args?.maxPhysicsStepsPerTick,
    });
  }

  addPrimitiveRigidBody(descr: any, position: any, rotation: any): Entity2d {
    return undefined!;
  }

}
