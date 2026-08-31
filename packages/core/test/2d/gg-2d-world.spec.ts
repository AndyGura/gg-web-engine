import { Entity2d, Gg2dWorld, IEntity, TickOrder } from '../../src';
import { mock2DBody } from '../mocks/body.mock';
import { mock2DObject } from '../mocks/object.mock';
import { collectConsoleCommands } from '../mocks/console-commands.mock';

class GgEntityMock extends IEntity {
  readonly tickOrder: TickOrder = TickOrder.OBJECTS_BINDING;
}

describe('Gg2dWorld', () => {
  let visualScene: { factory: { createPrimitive: jest.Mock }; dispose: () => void };
  let physicsWorld: { factory: { createRigidBody: jest.Mock }; gravity: any; dispose: () => void };
  let world: Gg2dWorld;

  beforeEach(() => {
    visualScene = {
      factory: { createPrimitive: jest.fn(() => mock2DObject()) },
      dispose: () => {},
    };
    physicsWorld = {
      factory: { createRigidBody: jest.fn(() => mock2DBody()) },
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
        await expect(commands.get('set_position')!()).rejects.toThrow('usage: set_position <name> <x> <y>');
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
        await expect(commands.get('set_rotation')!()).rejects.toThrow('usage: set_rotation <name> <angleRadians>');
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
      it('spawns a default-sized square at the given coordinates, dynamic by default', async () => {
        const commands = collectConsoleCommands(world);
        const result = await commands.get('spawn')!('SQUARE', '1', '2');

        expect(result).toMatch(/^spawned ".*" \(SQUARE\) at \{"x":1,"y":2\}$/);
        expect(visualScene.factory.createPrimitive).toHaveBeenCalledWith(
          { shape: 'SQUARE', dimensions: { x: 1, y: 1 } },
          {},
        );
        expect(physicsWorld.factory.createRigidBody).toHaveBeenCalledWith({
          shape: { shape: 'SQUARE', dimensions: { x: 1, y: 1 } },
          body: { dynamic: true },
        });
      });

      it('spawns a static prop when dynamic=0', async () => {
        const commands = collectConsoleCommands(world);
        await commands.get('spawn')!('CIRCLE', '0', '0', '0');

        expect(physicsWorld.factory.createRigidBody).toHaveBeenCalledWith({
          shape: { shape: 'CIRCLE', radius: 0.5 },
          body: { dynamic: false },
        });
      });

      it('supports every documented shape', async () => {
        const commands = collectConsoleCommands(world);
        for (const shape of ['SQUARE', 'CIRCLE']) {
          await expect(commands.get('spawn')!(shape, '0', '0')).resolves.toContain(`(${shape})`);
        }
      });

      it('rejects an unknown shape', async () => {
        const commands = collectConsoleCommands(world);
        await expect(commands.get('spawn')!('TRIANGLE', '0', '0')).rejects.toThrow('Unknown shape "TRIANGLE"');
      });

      it('rejects missing/non-numeric coordinates', async () => {
        const commands = collectConsoleCommands(world);
        await expect(commands.get('spawn')!('SQUARE', '1')).rejects.toThrow('usage: spawn');
      });
    });
  });
});
