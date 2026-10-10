import {
  Gg2dWorld,
  IParticleSystem2dComponent,
  ParticleRenderBuffers,
  ParticleSystem2dEntity,
  ParticleSystem2dRenderOptions,
  Point2,
} from '../../../src';
import { mock2DObject } from '../../mocks/object.mock';

type MockParticleSystem = IParticleSystem2dComponent & { lastBuffers: ParticleRenderBuffers | null; setCalls: number };

const mockParticleSystem = (options: ParticleSystem2dRenderOptions): MockParticleSystem => {
  const result: any = {
    ...mock2DObject(),
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
  factory: { createParticleSystem: jest.fn((o: ParticleSystem2dRenderOptions) => mockParticleSystem(o)) },
});

async function makeWorld() {
  const visualScene = mockScene();
  const world = new Gg2dWorld({ visualScene: visualScene as any });
  await world.init();
  world.worldClock.start();
  world.worldClock.pause();
  return { world, visualScene };
}

const drawnPositions = (system: MockParticleSystem): Point2[] => {
  const b = system.lastBuffers!;
  const result: Point2[] = [];
  for (let i = 0; i < b.count; i++) {
    result.push({ x: b.position[i * 2], y: b.position[i * 2 + 1] });
  }
  return result;
};

describe('ParticleSystem2dEntity', () => {
  it('Gg2dWorld.addParticleSystem creates the component through the factory and adds the entity', async () => {
    const { world, visualScene } = await makeWorld();
    const entity = world.addParticleSystem({ capacity: 16, blending: 'additive', zIndex: 3 }, { lifetime: 2 });
    expect(visualScene.factory.createParticleSystem).toHaveBeenCalledWith({
      capacity: 16,
      blending: 'additive',
      zIndex: 3,
    });
    expect(entity).toBeInstanceOf(ParticleSystem2dEntity);
    expect(entity.world).toBe(world);
    expect(entity.simulation.capacity).toBe(16);
    expect(entity.simulation.dimensions).toBe(2);
    expect(entity.simulation.buffers.dimensions).toBe(2);
    expect(entity.name).toMatch(/^ParticleSystem2dEntity_/);
  });

  it('simulates on world ticks with 2D vectors and hands the buffers to the component', async () => {
    const { world } = await makeWorld();
    const entity = world.addParticleSystem({ capacity: 4 }, { lifetime: 10, gravity: { x: 0, y: 100 } });
    const system = entity.particleSystem as MockParticleSystem;
    entity.emit(1, p => (p.velocity = { x: 10, y: 0 }));
    world.worldClock.step(500);
    expect(system.setCalls).toBe(1);
    const [drawn] = drawnPositions(system);
    expect(drawn.x).toBeCloseTo(5);
    expect(drawn.y).toBeCloseTo(25);
    expect('z' in system.lastBuffers!.position).toBe(false);
    expect(system.lastBuffers!.position.length).toBe(8);
  });

  it('emits at the attached target, offset in its frame, and leaves particles in world space', async () => {
    const { world } = await makeWorld();
    const target = { position: { x: 10, y: 0 }, rotation: Math.PI / 2 };
    const entity = world.addParticleSystem({ capacity: 8 }, { lifetime: 10, attachTo: target, offset: { x: 1, y: 0 } });
    const system = entity.particleSystem as MockParticleSystem;
    entity.emit(1, (p, ctx) => {
      p.velocity = ctx.directionToSim({ x: 1, y: 0 });
      p.data = ctx.pointToSim({ x: 0, y: 2 });
    });
    let first: any;
    entity.forEachParticle(p => (first = p));
    expect(first.position.x).toBeCloseTo(10);
    expect(first.position.y).toBeCloseTo(1);
    expect(first.velocity.x).toBeCloseTo(0);
    expect(first.velocity.y).toBeCloseTo(1);
    expect(first.data.x).toBeCloseTo(8);
    expect(first.data.y).toBeCloseTo(1);
    target.position = { x: 20, y: 0 };
    world.worldClock.step(1000);
    expect(entity.position.x).toBeCloseTo(20);
    expect(entity.rotation).toBeCloseTo(Math.PI / 2);
    entity.emit(1);
    world.worldClock.step(1);
    const drawn = drawnPositions(system);
    expect(drawn[0].x).toBeCloseTo(10);
    expect(drawn[0].y).toBeCloseTo(2);
    expect(drawn[1].x).toBeCloseTo(20);
    expect(drawn[1].y).toBeCloseTo(1);
    expect(system.position).toEqual({ x: 0, y: 0 });
  });

  it('moves the component with the emitter in local space', async () => {
    const { world } = await makeWorld();
    const entity = world.addParticleSystem({ capacity: 8 }, { space: 'local', lifetime: 10 });
    entity.position = { x: 3, y: 4 };
    entity.rotation = 1;
    entity.emit(1, (p, ctx) => (p.position = ctx.pointToSim({ x: 1, y: 0 })));
    world.worldClock.step(10);
    const system = entity.particleSystem as MockParticleSystem;
    expect(system.position).toEqual({ x: 3, y: 4 });
    expect(system.rotation).toBe(1);
    expect(drawnPositions(system)[0]).toEqual({ x: 1, y: 0 });
  });

  it('runs a fixed step with interpolation on the world clock', async () => {
    const { world } = await makeWorld();
    const entity = world.addParticleSystem({ capacity: 8 }, { fixedTimeStep: 1 / 30, lifetime: 10 });
    const system = entity.particleSystem as MockParticleSystem;
    entity.emit(1, p => (p.velocity = { x: 30, y: 0 }));
    world.worldClock.step(1000 / 60);
    expect(drawnPositions(system)[0].x).toBeCloseTo(0);
    world.worldClock.step(1000 / 60);
    expect(entity.simulation.time).toBeCloseTo(1 / 30);
    world.worldClock.step(1000 / 120);
    expect(drawnPositions(system)[0].x).toBeCloseTo(0.25, 3);
    world.worldClock.step(1000 / 120);
    expect(drawnPositions(system)[0].x).toBeCloseTo(0.5, 3);
  });

  it('hides the component with the entity and clear() empties the buffers', async () => {
    const { world } = await makeWorld();
    const entity = world.addParticleSystem({ capacity: 4 }, { lifetime: 10 });
    entity.visible = false;
    expect(entity.particleSystem.visible).toBe(false);
    entity.visible = true;
    expect(entity.particleSystem.visible).toBe(true);
    entity.emit(3);
    world.worldClock.step(10);
    expect(entity.count).toBe(3);
    entity.clear();
    expect(entity.count).toBe(0);
    expect((entity.particleSystem as MockParticleSystem).lastBuffers!.count).toBe(0);
  });
});
