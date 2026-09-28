import { Entity2d, Gg2dWorld, IEntity, PlayerCharacterController2d, Renderer2dEntity, TickOrder } from '../../src';
import { mock2DBody } from '../mocks/body.mock';
import { mock2DObject } from '../mocks/object.mock';
import { mockCharacterController2d } from '../mocks/character-controller-2d.mock';
import { collectConsoleCommands } from '../mocks/console-commands.mock';

class GgEntityMock extends IEntity {
  readonly tickOrder: TickOrder = TickOrder.OBJECTS_BINDING;
}

const mockRenderer2dEntity = (): Renderer2dEntity => {
  return new Renderer2dEntity({
    camera: {
      position: { x: 0, y: 0 },
      rotation: 0,
      enableRenderLayer() {},
      disableRenderLayer() {},
      isRenderLayerEnabled: () => true,
    },
    rendererOptions: { size: { x: 100, y: 100 } },
    canvas: null,
    physicsDebugViewActive: false,
    render() {},
    resizeRenderer() {},
    addToWorld() {},
    removeFromWorld() {},
    dispose() {},
  } as any);
};

describe('Gg2dWorld', () => {
  let visualScene: { factory: { createPrimitive: jest.Mock; createCapsule: jest.Mock }; dispose: () => void };
  let physicsWorld: {
    factory: { createRigidBody: jest.Mock; createCharacterController: jest.Mock };
    gravity: any;
    dispose: () => void;
  };
  let world: Gg2dWorld;

  beforeEach(() => {
    visualScene = {
      factory: {
        createPrimitive: jest.fn(() => mock2DObject()),
        createCapsule: jest.fn(() => mock2DObject()),
      },
      dispose: () => {},
    };
    physicsWorld = {
      factory: {
        createRigidBody: jest.fn(() => mock2DBody()),
        createCharacterController: jest.fn((options: any, transform: any) => {
          const created = mockCharacterController2d(options.radius, options.centersDistance);
          if (transform?.position) {
            created.position = transform.position;
          }
          return created;
        }),
      },
      gravity: { x: 0, y: 9.82 },
      dispose: () => {},
    };
    world = new Gg2dWorld({ visualScene: visualScene as any, physicsWorld: physicsWorld as any });
  });

  describe('console commands', () => {
    describe('gravity', () => {
      it('reports the current gravity vector with no args', async () => {
        const commands = collectConsoleCommands(world);
        expect(await commands.get('gravity')!()).toBe(JSON.stringify({ x: 0, y: 9.82 }));
      });

      it('sets the full x y vector when given 2 args', async () => {
        const commands = collectConsoleCommands(world);
        expect(await commands.get('gravity')!('1', '2')).toBe(JSON.stringify({ x: 1, y: 2 }));
        expect(physicsWorld.gravity).toEqual({ x: 1, y: 2 });
      });

      it('sets the y axis when given a single scalar', async () => {
        const commands = collectConsoleCommands(world);
        expect(await commands.get('gravity')!('5')).toBe(JSON.stringify({ x: 0, y: 5 }));
      });

      it('rejects non-numeric args', async () => {
        const commands = collectConsoleCommands(world);
        await expect(commands.get('gravity')!('a', 'b')).rejects.toThrow('Wrong arguments');
      });
    });

    describe('set_position', () => {
      it('requires a name', async () => {
        const commands = collectConsoleCommands(world);
        await expect(commands.get('set_position')!()).rejects.toThrow('usage: set_position NAME X Y');
      });

      it('teleports a named positionable entity', async () => {
        const commands = collectConsoleCommands(world);
        const entity = new Entity2d({ objectBody: mock2DBody() });
        entity.name = 'thing';
        world.addEntity(entity);

        expect(await commands.get('set_position')!('thing', '1', '2')).toBe(JSON.stringify({ x: 1, y: 2 }));
        expect(entity.position).toEqual({ x: 1, y: 2 });
      });

      it('rejects an entity with no position', async () => {
        const commands = collectConsoleCommands(world);
        const entity = new GgEntityMock();
        entity.name = 'plain';
        world.addEntity(entity);

        await expect(commands.get('set_position')!('plain', '1', '2')).rejects.toThrow('has no position');
      });

      it('rejects non-numeric coordinates', async () => {
        const commands = collectConsoleCommands(world);
        const entity = new Entity2d({ objectBody: mock2DBody() });
        entity.name = 'thing';
        world.addEntity(entity);

        await expect(commands.get('set_position')!('thing', '1', 'y')).rejects.toThrow('usage: set_position');
      });
    });

    describe('set_rotation', () => {
      it('rotates a named entity to the given angle in radians', async () => {
        const commands = collectConsoleCommands(world);
        const entity = new Entity2d({ objectBody: mock2DBody() });
        entity.name = 'thing';
        world.addEntity(entity);

        expect(await commands.get('set_rotation')!('thing', '1.57')).toBe(JSON.stringify(1.57));
        expect(entity.rotation).toBe(1.57);
      });

      it('requires a name', async () => {
        const commands = collectConsoleCommands(world);
        await expect(commands.get('set_rotation')!()).rejects.toThrow('usage: set_rotation NAME ANGLE_RADIANS');
      });

      it('rejects a non-numeric angle', async () => {
        const commands = collectConsoleCommands(world);
        const entity = new Entity2d({ objectBody: mock2DBody() });
        entity.name = 'thing';
        world.addEntity(entity);

        await expect(commands.get('set_rotation')!('thing', 'x')).rejects.toThrow('usage: set_rotation');
      });

      it('rejects an entity with no rotation', async () => {
        const commands = collectConsoleCommands(world);
        const entity = new GgEntityMock();
        entity.name = 'plain';
        world.addEntity(entity);

        await expect(commands.get('set_rotation')!('plain', '1')).rejects.toThrow('has no rotation');
      });
    });

    describe('spawn', () => {
      it('spawns a default-sized box at the given coordinates, dynamic by default', async () => {
        const commands = collectConsoleCommands(world);
        const result = await commands.get('spawn')!('BOX', '1', '2');

        expect(result).toMatch(/^spawned ".+" \(BOX\) at \{"x":1,"y":2\}$/);
        expect(visualScene.factory.createPrimitive).toHaveBeenCalledWith(
          { shape: 'BOX', dimensions: { x: 25, y: 25 } },
          {},
        );
        expect(physicsWorld.factory.createRigidBody).toHaveBeenCalledWith({
          shape: { shape: 'BOX', dimensions: { x: 25, y: 25 } },
          body: { bodyType: 'dynamic' },
        });
      });

      it('spawns a static prop when dynamic=0', async () => {
        const commands = collectConsoleCommands(world);
        await commands.get('spawn')!('CIRCLE', '0', '0', '0');

        expect(physicsWorld.factory.createRigidBody).toHaveBeenCalledWith({
          shape: { shape: 'CIRCLE', radius: 13 },
          body: { bodyType: 'static' },
        });
      });

      it('supports every documented shape', async () => {
        const commands = collectConsoleCommands(world);
        for (const shape of ['BOX', 'CIRCLE', 'CAPSULE', 'CONVEX_HULL', 'POLYGON']) {
          await expect(commands.get('spawn')!(shape, '0', '0')).resolves.toContain(`(${shape})`);
        }
      });

      it('rejects an unknown shape', async () => {
        const commands = collectConsoleCommands(world);
        await expect(commands.get('spawn')!('TRIANGLE', '0', '0')).rejects.toThrow('Unknown shape "TRIANGLE"');
      });

      it('rejects missing/non-numeric coordinates', async () => {
        const commands = collectConsoleCommands(world);
        await expect(commands.get('spawn')!('BOX', '1')).rejects.toThrow('usage: spawn');
      });
    });

    describe('player_spawn', () => {
      it('rejects when there is no renderer yet', async () => {
        const commands = collectConsoleCommands(world);
        await expect(commands.get('player_spawn')!('0', '0')).rejects.toThrow('renderer');
      });

      it('spawns a character controller and a PlayerCharacterController2d wired to the first renderer', async () => {
        world.addEntity(mockRenderer2dEntity());
        const commands = collectConsoleCommands(world);

        const result = await commands.get('player_spawn')!('1', '2');

        expect(physicsWorld.factory.createCharacterController).toHaveBeenCalledWith(
          expect.objectContaining({ radius: 20, centersDistance: 40 }),
          { position: { x: 1, y: 2 } },
        );
        expect(result).toMatch(/^spawned ".+" at \{"x":1,"y":2\}, controlled by ".+"$/);
        const controllerName = result.match(/controlled by "(.*)"$/)![1];
        expect(world.getEntityByName<PlayerCharacterController2d>(controllerName)).toBeInstanceOf(
          PlayerCharacterController2d,
        );
      });

      it('rejects missing/non-numeric coordinates', async () => {
        world.addEntity(mockRenderer2dEntity());
        const commands = collectConsoleCommands(world);
        await expect(commands.get('player_spawn')!('1')).rejects.toThrow('usage: player_spawn');
      });
    });
  });
});
