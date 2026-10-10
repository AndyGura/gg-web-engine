import { MatterWorldComponent } from '../../src';

describe('MatterWorldComponent before init()', () => {
  it('names the fix when a body is added to a world that was never initialized', () => {
    const world = new MatterWorldComponent();
    const body = world.factory.createRigidBody({ shape: { shape: 'BOX', dimensions: { x: 1, y: 1 } }, body: {} });
    expect(() => body.addToWorld({ physicsWorld: world } as any)).toThrow(
      /MatterWorldComponent is not initialized yet.*adding bodies to the world.*await world\.init\(\)/,
    );
  });
});
