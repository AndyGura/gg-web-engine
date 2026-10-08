import { Entity2d, GgWorld, LoadingView } from '../../src';

export class MockWorld extends GgWorld<any, any> {
  constructor(
    args: {
      physicsWorld?: any;
      maxTickDelta?: number;
      pauseWhenHidden?: boolean;
      fixedPhysicsStep?: number;
      maxPhysicsStepsPerTick?: number;
      loadingScreen?: boolean | LoadingView;
    } = {},
  ) {
    super({
      visualScene: {
        init: async () => {
        },
        dispose: () => {
        },
      } as any,
      physicsWorld: args.physicsWorld ?? ({
        init: async () => {
        },
        simulate: () => {
        },
        dispose: () => {
        },
      } as any),
      maxTickDelta: args.maxTickDelta,
      pauseWhenHidden: args.pauseWhenHidden,
      fixedPhysicsStep: args.fixedPhysicsStep,
      maxPhysicsStepsPerTick: args.maxPhysicsStepsPerTick,
      loadingScreen: args.loadingScreen,
    });
  }

  addPrimitiveRigidBody(descr: any, position: any, rotation: any): Entity2d {
    return undefined!;
  }

}
