import { Entity3d, Gg3dWorld, IEntity, Qtrn, TickOrder } from '../../src';
import { mock3DBody } from '../mocks/body.mock';
import { mock3DObject } from '../mocks/object.mock';
import { collectConsoleCommands } from '../mocks/console-commands.mock';

class GgEntityMock extends IEntity {
  readonly tickOrder: TickOrder = TickOrder.OBJECTS_BINDING;
}

describe('Gg3dWorld', () => {
  let visualScene: { factory: { createPrimitive: jest.Mock }; dispose: () => void };
  let physicsWorld: { factory: { createRigidBody: jest.Mock }; gravity: any; dispose: () => void };
  let world: Gg3dWorld;

  beforeEach(() => {
    visualScene = {
      factory: { createPrimitive: jest.fn(() => mock3DObject()) },
      dispose: () => {},
    };
    physicsWorld = {
      factory: { createRigidBody: jest.fn(() => mock3DBody()) },
      gravity: { x: 0, y: 0, z: -9.82 },
      dispose: () => {},
    };
    world = new Gg3dWorld({ visualScene: visualScene as any, physicsWorld: physicsWorld as any });
  });

  describe('console commands', () => {
    describe('gravity', () => {
      it('reports the current gravity vector with no args', async () => {
        const commands = collectConsoleCommands(world);
        expect(await commands.get('gravity')!()).toBe(JSON.stringify({ x: 0, y: 0, z: -9.82 }));
      });

      it('sets the full x y z vector when given 3 args', async () => {
        const commands = collectConsoleCommands(world);
        expect(await commands.get('gravity')!('1', '2', '3')).toBe(JSON.stringify({ x: 1, y: 2, z: 3 }));
        expect(physicsWorld.gravity).toEqual({ x: 1, y: 2, z: 3 });
      });

      it('sets the -z axis when given a single scalar', async () => {
        const commands = collectConsoleCommands(world);
        expect(await commands.get('gravity')!('5')).toBe(JSON.stringify({ x: 0, y: 0, z: -5 }));
      });

      it('rejects non-numeric args', async () => {
        const commands = collectConsoleCommands(world);
        await expect(commands.get('gravity')!('a', 'b', 'c')).rejects.toThrow('Wrong arguments');
      });
    });

    describe('set_position', () => {
      it('requires a name', async () => {
        const commands = collectConsoleCommands(world);
        await expect(commands.get('set_position')!()).rejects.toThrow('usage: set_position <name> <x> <y> <z>');
      });

      it('teleports a named positionable entity', async () => {
        const commands = collectConsoleCommands(world);
        const entity = new Entity3d({ objectBody: mock3DBody() });
        entity.name = 'thing';
        world.addEntity(entity);

        expect(await commands.get('set_position')!('thing', '1', '2', '3')).toBe(
          JSON.stringify({ x: 1, y: 2, z: 3 }),
        );
        expect(entity.position).toEqual({ x: 1, y: 2, z: 3 });
      });

      it('rejects an entity with no position', async () => {
        const commands = collectConsoleCommands(world);
        const entity = new GgEntityMock();
        entity.name = 'plain';
        world.addEntity(entity);

        await expect(commands.get('set_position')!('plain', '1', '2', '3')).rejects.toThrow('has no position');
      });

      it('rejects non-numeric coordinates', async () => {
        const commands = collectConsoleCommands(world);
        const entity = new Entity3d({ objectBody: mock3DBody() });
        entity.name = 'thing';
        world.addEntity(entity);

        await expect(commands.get('set_position')!('thing', '1', 'x', '3')).rejects.toThrow('usage: set_position');
      });
    });

    describe('set_rotation', () => {
      it('accepts a raw quaternion (4 numbers)', async () => {
        const commands = collectConsoleCommands(world);
        const entity = new Entity3d({ objectBody: mock3DBody() });
        entity.name = 'thing';
        world.addEntity(entity);

        const result = await commands.get('set_rotation')!('thing', '0', '0', '0', '1');
        expect(JSON.parse(result)).toEqual({ x: 0, y: 0, z: 0, w: 1 });
      });

      it('accepts euler angles (3 numbers), converted via Qtrn.fromEuler', async () => {
        const commands = collectConsoleCommands(world);
        const entity = new Entity3d({ objectBody: mock3DBody() });
        entity.name = 'thing';
        world.addEntity(entity);

        const result = await commands.get('set_rotation')!('thing', '0', '0', '1.57');
        expect(JSON.parse(result)).toEqual(Qtrn.fromEuler({ x: 0, y: 0, z: 1.57 }));
      });

      it('rejects a wrong argument count', async () => {
        const commands = collectConsoleCommands(world);
        const entity = new Entity3d({ objectBody: mock3DBody() });
        entity.name = 'thing';
        world.addEntity(entity);

        await expect(commands.get('set_rotation')!('thing', '0', '0')).rejects.toThrow('usage: set_rotation');
      });

      it('rejects an entity with no rotation', async () => {
        const commands = collectConsoleCommands(world);
        const entity = new GgEntityMock();
        entity.name = 'plain';
        world.addEntity(entity);

        await expect(commands.get('set_rotation')!('plain', '0', '0', '0')).rejects.toThrow('has no rotation');
      });
    });

    describe('spawn', () => {
      it('spawns a default-sized box at the given coordinates, dynamic by default', async () => {
        const commands = collectConsoleCommands(world);
        const result = await commands.get('spawn')!('BOX', '1', '2', '3');

        expect(result).toMatch(/^spawned ".*" \(BOX\) at \{"x":1,"y":2,"z":3\}$/);
        expect(visualScene.factory.createPrimitive).toHaveBeenCalledWith(
          { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } },
          {},
        );
        expect(physicsWorld.factory.createRigidBody).toHaveBeenCalledWith({
          shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } },
          body: { dynamic: true },
        });
      });

      it('spawns a static prop when dynamic=0', async () => {
        const commands = collectConsoleCommands(world);
        await commands.get('spawn')!('SPHERE', '0', '0', '0', '0');

        expect(physicsWorld.factory.createRigidBody).toHaveBeenCalledWith({
          shape: { shape: 'SPHERE', radius: 0.5 },
          body: { dynamic: false },
        });
      });

      it('supports every documented shape', async () => {
        const commands = collectConsoleCommands(world);
        for (const shape of ['BOX', 'SPHERE', 'CYLINDER', 'CONE', 'CAPSULE', 'PLANE']) {
          await expect(commands.get('spawn')!(shape, '0', '0', '0')).resolves.toContain(`(${shape})`);
        }
      });

      it('rejects an unknown shape', async () => {
        const commands = collectConsoleCommands(world);
        await expect(commands.get('spawn')!('TORUS', '0', '0', '0')).rejects.toThrow('Unknown shape "TORUS"');
      });

      it('rejects missing/non-numeric coordinates', async () => {
        const commands = collectConsoleCommands(world);
        await expect(commands.get('spawn')!('BOX', '1', '2')).rejects.toThrow('usage: spawn');
      });
    });
  });
});
