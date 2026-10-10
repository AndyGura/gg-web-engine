import {
  Gg3dWorld,
  IParticleSystem3dComponent,
  ParticleRenderBuffers,
  ParticleSystem3dEntity,
  ParticleSystem3dRenderOptions,
  Pnt3,
  Point3,
  Qtrn,
} from '../../../src';
import { mock3DObject } from '../../mocks/object.mock';

type MockParticleSystem = IParticleSystem3dComponent & { lastBuffers: ParticleRenderBuffers | null; setCalls: number };

const mockParticleSystem = (options: ParticleSystem3dRenderOptions): MockParticleSystem => {
  const result: any = {
    ...mock3DObject(),
    capacity: options.capacity,
    renderOptions: options,
    texture: options.texture ?? null,
    lastBuffers: null,
    setCalls: 0,
    setParticles(buffers: ParticleRenderBuffers) {
      result.lastBuffers = buffers;
      result.setCalls++;
    },
  };
  return result as MockParticleSystem;
};

const mockScene = () => ({
  init: async () => {},
  dispose: () => {},
  factory: { createParticleSystem: jest.fn((o: ParticleSystem3dRenderOptions) => mockParticleSystem(o)) },
});

async function makeWorld() {
  const visualScene = mockScene();
  const world = new Gg3dWorld({ visualScene: visualScene as any });
  await world.init();
  world.worldClock.start();
  world.worldClock.pause();
  return { world, visualScene };
}

const drawnPositions = (system: MockParticleSystem): Point3[] => {
  const b = system.lastBuffers!;
  const result: Point3[] = [];
  for (let i = 0; i < b.count; i++) {
    result.push({ x: b.position[i * 3], y: b.position[i * 3 + 1], z: b.position[i * 3 + 2] });
  }
  return result;
};

describe('ParticleSystem3dEntity', () => {
  it('Gg3dWorld.addParticleSystem creates the component through the factory and adds the entity', async () => {
    const { world, visualScene } = await makeWorld();
    const entity = world.addParticleSystem({ capacity: 16, blending: 'additive' }, { lifetime: 2 });
    expect(visualScene.factory.createParticleSystem).toHaveBeenCalledWith({ capacity: 16, blending: 'additive' });
    expect(entity).toBeInstanceOf(ParticleSystem3dEntity);
    expect(entity.world).toBe(world);
    expect(entity.simulation.capacity).toBe(16);
    expect(entity.name).toMatch(/^ParticleSystem3dEntity_/);
  });

  it('simulates on world ticks and hands the buffers to the component', async () => {
    const { world } = await makeWorld();
    const entity = world.addParticleSystem({ capacity: 4 }, { lifetime: 10 });
    const system = entity.particleSystem as MockParticleSystem;
    entity.emit(1, p => (p.velocity = { x: 1, y: 0, z: 0 }));
    world.worldClock.step(500);
    expect(system.setCalls).toBe(1);
    expect(drawnPositions(system)[0].x).toBeCloseTo(0.5);
    // a paused world doesn't tick, so nothing moves
    expect(world.worldClock.isPaused).toBe(true);
    expect(drawnPositions(system)[0].x).toBeCloseTo(0.5);
  });

  it('emits at the attached target, offset in its frame, and leaves particles in world space', async () => {
    const { world } = await makeWorld();
    const target = { position: { x: 10, y: 0, z: 0 }, rotation: Qtrn.fromAngle(Pnt3.Z, Math.PI / 2) };
    const entity = world.addParticleSystem({ capacity: 8 }, { lifetime: 10, attachTo: target, offset: { x: 1, y: 0, z: 0 } });
    const system = entity.particleSystem as MockParticleSystem;
    entity.emit(1, (p, ctx) => {
      p.velocity = ctx.directionToSim({ x: 1, y: 0, z: 0 });
      p.data = ctx.pointToSim({ x: 0, y: 2, z: 0 });
    });
    let first: any;
    entity.forEachParticle(p => (first = p));
    expect(first.position.x).toBeCloseTo(10);
    expect(first.position.y).toBeCloseTo(1);
    expect(first.velocity.y).toBeCloseTo(1);
    expect(first.data.x).toBeCloseTo(8);
    expect(first.data.y).toBeCloseTo(1);
    // the target moves on; the spawned particle doesn't follow, the next one starts at the new spot
    target.position = { x: 20, y: 0, z: 0 };
    world.worldClock.step(1000);
    expect(entity.position.x).toBeCloseTo(20);
    entity.emit(1);
    world.worldClock.step(1);
    const drawn = drawnPositions(system);
    expect(drawn[0].x).toBeCloseTo(10);
    expect(drawn[0].y).toBeCloseTo(2);
    expect(drawn[1].x).toBeCloseTo(20);
    expect(drawn[1].y).toBeCloseTo(1);
    // the component itself stays at the origin in world space
    expect(system.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('moves the component with the emitter in local space', async () => {
    const { world } = await makeWorld();
    const entity = world.addParticleSystem({ capacity: 8 }, { space: 'local', lifetime: 10 });
    entity.position = { x: 3, y: 4, z: 5 };
    entity.emit(1, (p, ctx) => (p.position = ctx.pointToSim({ x: 1, y: 0, z: 0 })));
    world.worldClock.step(10);
    const system = entity.particleSystem as MockParticleSystem;
    expect(system.position).toEqual({ x: 3, y: 4, z: 5 });
    expect(drawnPositions(system)[0]).toEqual({ x: 1, y: 0, z: 0 });
  });

  it('runs a 30 Hz fixed step with interpolation on the world clock', async () => {
    const { world } = await makeWorld();
    const entity = world.addParticleSystem({ capacity: 8 }, { fixedTimeStep: 1 / 30, lifetime: 10 });
    const system = entity.particleSystem as MockParticleSystem;
    entity.emit(1, p => (p.velocity = { x: 30, y: 0, z: 0 }));
    world.worldClock.step(1000 / 60);
    expect(entity.simulation.time).toBe(0);
    expect(drawnPositions(system)[0].x).toBeCloseTo(0);
    // the first step ran: drawn between the state before it (0) and after it (1), at the leftover time
    world.worldClock.step(1000 / 60);
    expect(entity.simulation.time).toBeCloseTo(1 / 30);
    expect(drawnPositions(system)[0].x).toBeCloseTo(0, 3);
    world.worldClock.step(1000 / 120);
    expect(drawnPositions(system)[0].x).toBeCloseTo(0.25, 3);
    world.worldClock.step(1000 / 120);
    expect(drawnPositions(system)[0].x).toBeCloseTo(0.5, 3);
    world.worldClock.step(1000 / 60);
    expect(drawnPositions(system)[0].x).toBeCloseTo(1, 3);
  });

  it('hides the component with the entity', async () => {
    const { world } = await makeWorld();
    const entity = world.addParticleSystem({ capacity: 2 });
    entity.visible = false;
    expect(entity.particleSystem.visible).toBe(false);
    entity.visible = true;
    expect(entity.particleSystem.visible).toBe(true);
  });

  it('clear() kills every particle and empties the drawn buffers', async () => {
    const { world } = await makeWorld();
    const entity = world.addParticleSystem({ capacity: 4 }, { lifetime: 10 });
    entity.emit(3);
    world.worldClock.step(10);
    entity.clear();
    expect(entity.count).toBe(0);
    expect((entity.particleSystem as MockParticleSystem).lastBuffers!.count).toBe(0);
  });
});
