import {
  AudioSource3dEntity,
  Camera3dEntity,
  CharacterController3dEntity,
  Entity3d,
  Frame3d,
  FrameSwitch,
  Gg3dWorld,
  IEntity,
  IFrameSwitchable,
  IParticleSystem3dComponent,
  IPositionable3d,
  Light3dEntity,
  MapGraph,
  MapGraph3dEntity,
  MapGraphNodeType,
  ParticleRenderBuffers,
  ParticleSystem3dEntity,
  PlayerCharacterController,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  RaycastVehicle3dEntity,
  Renderer3dEntity,
  SurfaceFollowingEntity,
  TickOrder,
  Trigger3dEntity,
  claimFrameSwitch,
  switchBodyFrame,
} from '../../src';
import { mock3DBody } from '../mocks/body.mock';
import { mock3DObject } from '../mocks/object.mock';
import { mockCarProperties, mockRaycastVehicle } from '../mocks/raycast-vehicle.mock';
import { mockCharacterController } from '../mocks/character-controller.mock';
import { KeyboardInput } from '../../src';

const SWITCH_TO = new Frame3d({ x: 120.5, y: -40.25, z: 3 }, 1.234);

const expectPointClose = (actual: Point3, expected: Point3, digits = 9) => {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
  expect(actual.z).toBeCloseTo(expected.z, digits);
};

const expectRotationClose = (actual: Point4, expected: Point4, digits = 9) => {
  // q and -q are the same orientation
  const sign = Math.sign(actual.w * expected.w + actual.x * expected.x + actual.y * expected.y + actual.z * expected.z) || 1;
  expect(actual.x * sign).toBeCloseTo(expected.x, digits);
  expect(actual.y * sign).toBeCloseTo(expected.y, digits);
  expect(actual.z * sign).toBeCloseTo(expected.z, digits);
  expect(actual.w * sign).toBeCloseTo(expected.w, digits);
};

class PlainPositionable extends IEntity implements IPositionable3d {
  static readonly entityTypeName: string = 'PlainPositionable';
  readonly tickOrder = TickOrder.OBJECTS_BINDING;
  position: Point3 = { x: 1, y: 2, z: 3 };
  rotation: Point4 = Qtrn.O;
}

class TickProbe extends IEntity {
  static readonly entityTypeName: string = 'TickProbe';
  constructor(
    public readonly tickOrder: number,
    onTick: () => void,
  ) {
    super();
    this.tick$.subscribe(() => onTick());
  }
}

const mockCamera = () => ({
  ...mock3DObject(),
  fov: 60,
  supportsFov: true,
  enableRenderLayer() {},
  disableRenderLayer() {},
  isRenderLayerEnabled: () => true,
});

const mockRenderer = (camera: any) =>
  new Renderer3dEntity({
    camera,
    rendererOptions: { size: { x: 100, y: 100 } },
    canvas: null,
    physicsDebugViewActive: false,
    render() {},
    resizeRenderer() {},
    addToWorld() {},
    removeFromWorld() {},
    dispose() {},
  } as any);

describe('Gg3dWorld.switchFrame', () => {
  let world: Gg3dWorld;
  let simulate: jest.Mock;
  let physicsWorld: any;

  beforeEach(async () => {
    simulate = jest.fn();
    physicsWorld = {
      init: async () => {},
      simulate,
      dispose: () => {},
      gravity: { x: 0, y: 0, z: -9.82 },
      factory: { createRigidBody: jest.fn(() => mock3DBody({ shape: 'PLANE' })) },
      registerCollisionGroup: () => 5,
      deregisterCollisionGroup: () => {},
      removed$: { pipe: () => ({ subscribe: () => ({ unsubscribe() {} }) }) },
      onFrameSwitch: jest.fn(),
    };
    world = new Gg3dWorld({
      visualScene: { init: async () => {}, dispose: () => {} } as any,
      physicsWorld,
    });
    await world.init();
    world.worldClock.start();
    world.worldClock.pause();
  });

  afterEach(() => {
    delete (window as any).ggstatic;
    jest.restoreAllMocks();
  });

  it('moves a body by delta, keeps its global pose and emits frameSwitched$', () => {
    const body = mock3DBody();
    const object3D = mock3DObject();
    const entity = new Entity3d({ object3D, objectBody: body });
    world.addEntity(entity);
    entity.position = { x: 10, y: -5, z: 1 };
    entity.rotation = Qtrn.fromAngle(Pnt3.Z, 0.3);
    body.linearVelocity = { x: 3, y: 4, z: -1 };
    body.angularVelocity = { x: 0.1, y: 0.2, z: 0.5 };
    const globalPos = world.toGlobalPoint(entity.position);
    const globalRot = world.toGlobalRotation(entity.rotation);
    const globalVel = world.toGlobalDirection(body.linearVelocity);
    const events: FrameSwitch[] = [];
    world.frameSwitched$.subscribe(e => events.push(e));

    world.switchFrame(SWITCH_TO);

    expect(world.frame).toBe(SWITCH_TO);
    expect(events.length).toBe(1);
    expect(events[0].previousFrame).toBe(Frame3d.IDENTITY);
    expect(events[0].frame).toBe(SWITCH_TO);
    expect(events[0].delta.equals(SWITCH_TO.inverse(), 1e-12, 1e-12)).toBe(true);
    expectPointClose(world.toGlobalPoint(entity.position), globalPos);
    expectRotationClose(world.toGlobalRotation(entity.rotation), globalRot);
    expectPointClose(world.toGlobalDirection(body.linearVelocity), globalVel);
    expectPointClose(body.angularVelocity as Point3, events[0].delta.toGlobalDirection({ x: 0.1, y: 0.2, z: 0.5 }));
    // the display object is bound to the body
    expect(object3D.position).toEqual(body.position);
    expect(object3D.rotation).toEqual(body.rotation);
    expect(physicsWorld.onFrameSwitch).toHaveBeenCalledWith(events[0].delta);
  });

  it('composes: two switches keep global poses, and switching back restores local ones', () => {
    const entity = new Entity3d({ objectBody: mock3DBody() });
    world.addEntity(entity);
    entity.position = { x: 7, y: 8, z: 9 };
    entity.rotation = Qtrn.fromAngle(Pnt3.Z, -0.7);
    const global = world.toGlobalPoint(entity.position);
    world.switchFrame(SWITCH_TO);
    world.switchFrame(new Frame3d({ x: -3000, y: 12, z: -1 }, -2.5));
    expectPointClose(world.toGlobalPoint(entity.position), global, 8);
    world.switchFrame(Frame3d.IDENTITY);
    expectPointClose(entity.position, { x: 7, y: 8, z: 9 }, 8);
    expectRotationClose(entity.rotation, Qtrn.fromAngle(Pnt3.Z, -0.7), 8);
  });

  it("uses a physics component's own onFrameSwitch instead of its setters", () => {
    const body = mock3DBody() as any;
    const positions: Point3[] = [];
    let p = { x: 1, y: 1, z: 1 };
    Object.defineProperty(body, 'position', {
      get: () => p,
      set: v => {
        positions.push(v);
        p = v;
      },
    });
    body.onFrameSwitch = jest.fn((delta: Frame3d) => {
      p = delta.toGlobalPoint(p);
    });
    const entity = new Entity3d({ objectBody: body });
    world.addEntity(entity);
    world.switchFrame(SWITCH_TO);
    expect(body.onFrameSwitch).toHaveBeenCalledTimes(1);
    expect(positions).toEqual([]);
    expectPointClose(entity.position, SWITCH_TO.toLocalPoint({ x: 1, y: 1, z: 1 }));
  });

  it('called before the physics step of a tick, applies right after it, before transforms are bound', () => {
    const entity = new Entity3d({ objectBody: mock3DBody() });
    world.addEntity(entity);
    entity.position = { x: 5, y: 0, z: 0 };
    const seenBySimulate: Point3[] = [];
    simulate.mockImplementation(() => seenBySimulate.push(entity.objectBody!.position));
    let seenAfterPhysics: Point3 | null = null;
    let frameBeforePhysics: Frame3d | null = null;
    world.addEntity(
      new TickProbe(TickOrder.PHYSICS_SIMULATION - 10, () => {
        world.switchFrame(SWITCH_TO);
        frameBeforePhysics = world.frame;
        expect(world.pendingFrame).toBe(SWITCH_TO);
      }),
    );
    world.addEntity(new TickProbe(TickOrder.PHYSICS_SIMULATION + 1, () => (seenAfterPhysics = entity.position)));
    world.worldClock.step(16);
    expect(frameBeforePhysics).toBe(Frame3d.IDENTITY);
    expect(seenBySimulate).toEqual([{ x: 5, y: 0, z: 0 }]);
    expect(world.frame).toBe(SWITCH_TO);
    expect(world.pendingFrame).toBeNull();
    expectPointClose(seenAfterPhysics!, SWITCH_TO.toLocalPoint({ x: 5, y: 0, z: 0 }));
  });

  it('called after the physics step of a tick, applies immediately', () => {
    let frameRightAfter: Frame3d | null = null;
    world.addEntity(
      new TickProbe(TickOrder.CONTROLLERS, () => {
        world.switchFrame(SWITCH_TO);
        frameRightAfter = world.frame;
      }),
    );
    world.worldClock.step(16);
    expect(frameRightAfter).toBe(SWITCH_TO);
  });

  it('moves a camera shared by a Camera3dEntity and a Renderer3dEntity once', () => {
    const camera = mockCamera();
    camera.position = { x: 1, y: 2, z: 3 };
    const cameraEntity = new Camera3dEntity(camera as any);
    cameraEntity.position = { x: 1, y: 2, z: 3 };
    const renderer = mockRenderer(camera);
    world.addEntity(cameraEntity);
    world.addEntity(renderer);
    world.switchFrame(SWITCH_TO);
    const expected = SWITCH_TO.toLocalPoint({ x: 1, y: 2, z: 3 });
    expectPointClose(camera.position, expected);
    expectPointClose(cameraEntity.position, expected);
    expectPointClose(renderer.position, expected);
  });

  it('switches children before their parents (a vehicle places its wheels last)', () => {
    const vehicleComponent = mockRaycastVehicle();
    const wheelPositions: Point3[] = [{ x: 9, y: 9, z: 9 }];
    let chassis = { x: 0, y: 0, z: 0 };
    Object.defineProperty(vehicleComponent, 'position', {
      get: () => chassis,
      set: v => (chassis = v),
    });
    (vehicleComponent as any).getWheelTransform = () => ({ position: Pnt3.add(chassis, { x: 1, y: 2, z: 0 }), rotation: Qtrn.O });
    const props = mockCarProperties();
    (props as any).wheelBase.shared.display = { displayObject: mock3DObject() };
    const vehicle = new RaycastVehicle3dEntity(props, mock3DObject(), vehicleComponent);
    world.addEntity(vehicle);
    vehicle.position = { x: 50, y: 0, z: 0 };
    const wheel = vehicle.children.find(c => c instanceof Entity3d) as Entity3d;
    expect(wheel).toBeDefined();
    world.switchFrame(SWITCH_TO);
    // where the vehicle component says, not the wheel's own pose moved by delta on top
    expectPointClose(wheel.position, Pnt3.add(vehicle.position, { x: 1, y: 2, z: 0 }));
    expect(wheelPositions.length).toBe(1);
  });

  it('rotates a raycast vehicle’s sampled velocities', () => {
    const vehicleComponent = mockRaycastVehicle();
    vehicleComponent.linearVelocity = { x: 10, y: 0, z: 0 };
    const vehicle = new RaycastVehicle3dEntity(mockCarProperties(), mock3DObject(), vehicleComponent);
    world.addEntity(vehicle);
    world.switchFrame(SWITCH_TO);
    const sampled = (vehicle as any)._velocityBeforeStep as Point3;
    expectPointClose(sampled, SWITCH_TO.toLocalDirection({ x: 10, y: 0, z: 0 }));
  });

  it("moves a character controller's capsule, mesh and momentum", () => {
    const controller = mockCharacterController();
    const mesh = mock3DObject();
    const character = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, mesh, controller);
    world.addEntity(character);
    character.position = { x: 2, y: 3, z: 1 };
    character.fallVelocity = { x: 0, y: 0, z: -3 };
    character.airHorizontalVelocity = { x: 4, y: 0, z: 0 };
    character.externalDisplacement = { x: 0, y: 1, z: 0 };
    world.switchFrame(SWITCH_TO);
    const d = SWITCH_TO.inverse();
    expectPointClose(character.position, d.toGlobalPoint({ x: 2, y: 3, z: 1 }));
    expectPointClose(controller.position, character.position);
    expectPointClose(mesh.position, character.position);
    expectPointClose(character.fallVelocity, { x: 0, y: 0, z: -3 });
    expectPointClose(character.airHorizontalVelocity, d.toGlobalDirection({ x: 4, y: 0, z: 0 }));
    expectPointClose(character.externalDisplacement, d.toGlobalDirection({ x: 0, y: 1, z: 0 }));
    expectPointClose(controller.up, Pnt3.Z);
  });

  it('moves a trigger, a light and a static audio source', () => {
    const triggerBody: any = { ...mock3DBody(), checkOverlaps() {}, onEntityEntered: { pipe: () => null } };
    const trigger = new Trigger3dEntity(triggerBody);
    trigger.position = { x: 4, y: 4, z: 0 };
    const light = new Light3dEntity({ ...mock3DObject(), lightType: 'SPOT' } as any);
    light.position = { x: 0, y: 10, z: 5 };
    light.lookAt({ x: 0, y: 0, z: 0 });
    const lightDirection = Pnt3.rot(Pnt3.nZ, light.rotation);
    const source = new AudioSource3dEntity({ ...mock3DObject(), play() {}, pause() {}, stop() {} } as any);
    source.position = { x: -1, y: -2, z: 0 };
    world.addEntity(trigger);
    world.addEntity(light);
    world.addEntity(source);
    world.switchFrame(SWITCH_TO);
    const d = SWITCH_TO.inverse();
    expectPointClose(trigger.position, d.toGlobalPoint({ x: 4, y: 4, z: 0 }));
    expectPointClose(triggerBody.position, trigger.position);
    expectPointClose(light.position, d.toGlobalPoint({ x: 0, y: 10, z: 5 }));
    // still aimed at the same (moved) target
    expectPointClose(Pnt3.rot(Pnt3.nZ, light.rotation), d.toGlobalDirection(lightDirection));
    expectPointClose(source.position, d.toGlobalPoint({ x: -1, y: -2, z: 0 }));
  });

  it('moves the live particles of a world-space particle system', () => {
    let last: ParticleRenderBuffers | null = null;
    const particleSystem = {
      ...mock3DObject(),
      capacity: 8,
      setParticles(b: ParticleRenderBuffers) {
        last = b;
      },
    } as unknown as IParticleSystem3dComponent;
    const system = new ParticleSystem3dEntity(particleSystem, {});
    world.addEntity(system);
    system.emit(1, p => {
      p.position = { x: 3, y: 0, z: 1 };
      p.velocity = { x: 1, y: 0, z: 0 };
    });
    world.switchFrame(SWITCH_TO);
    const d = SWITCH_TO.inverse();
    system.forEachParticle(p => {
      expectPointClose(p.position, d.toGlobalPoint({ x: 3, y: 0, z: 1 }));
      expectPointClose(p.prevPosition, d.toGlobalPoint({ x: 3, y: 0, z: 1 }));
      expectPointClose(p.velocity, d.toGlobalDirection({ x: 1, y: 0, z: 0 }));
    });
    const drawn = { x: last!.position[0], y: last!.position[1], z: last!.position[2] };
    expectPointClose(drawn, d.toGlobalPoint({ x: 3, y: 0, z: 1 }), 4);
  });

  it('moves map graph nodes and the cursor, keeping the loaded chunk set', () => {
    const a: MapGraphNodeType = { path: 'a', position: { x: 0, y: 0, z: 0 }, loadOptions: {} };
    const b: MapGraphNodeType = { path: 'b', position: { x: 100, y: 0, z: 0 }, loadOptions: {} };
    const mapGraph = new MapGraph3dEntity(MapGraph.fromMapArray([a, b]), { loadDepth: 0 });
    jest.spyOn(world.loader, 'loadGgGlb').mockImplementation((() => new Promise(() => {})) as any);
    world.addEntity(mapGraph);
    mapGraph.loaderCursor$.next({ x: 90, y: 1, z: 0 });
    world.switchFrame(SWITCH_TO);
    const d = SWITCH_TO.inverse();
    expectPointClose(a.position, d.toGlobalPoint({ x: 0, y: 0, z: 0 }));
    expectPointClose(b.position, d.toGlobalPoint({ x: 100, y: 0, z: 0 }));
    expectRotationClose(b.rotation!, d.rotation);
    expectPointClose(mapGraph.loaderCursor$.getValue(), d.toGlobalPoint({ x: 90, y: 1, z: 0 }));
    expect(mapGraph.mapGraph.getNearestDummy(mapGraph.mapGraph.nodes(), mapGraph.loaderCursor$.getValue()).data).toBe(
      b,
    );
  });

  it('moves the entities of a chunk that was loading during the switch once they arrive', async () => {
    const node: MapGraphNodeType = { path: 'a', position: { x: 10, y: 0, z: 0 }, loadOptions: {} };
    const mapGraph = new MapGraph3dEntity(MapGraph.fromMapArray([node]), { loadDepth: 0 });
    mapGraph.loadRateLimit = 0;
    let resolve!: (v: any) => void;
    jest.spyOn(world.loader, 'loadGgGlb').mockImplementation(
      ((_: string, options: any) =>
        new Promise(r => {
          resolve = () => {
            const e = new Entity3d({ object3D: mock3DObject() });
            e.position = options.position;
            r({ entities: [e], meta: { dummies: [] } });
          };
        })) as any,
    );
    world.addEntity(mapGraph);
    world.worldClock.step(16);
    world.worldClock.step(16);
    expect(resolve).toBeDefined();
    world.switchFrame(SWITCH_TO);
    resolve(null);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
    const [entity] = mapGraph.loaded.get(node)!;
    expectPointClose(entity.position, node.position);
    expectPointClose(entity.position, SWITCH_TO.toLocalPoint({ x: 10, y: 0, z: 0 }));
  });

  it("answers a surface-following entity's surface function in the new frame", () => {
    const surface = new SurfaceFollowingEntity(p => ({ position: { x: p.x, y: p.y, z: 0.1 * p.x }, normal: Pnt3.Z }));
    world.addEntity(surface);
    world.switchFrame(SWITCH_TO);
    const d = SWITCH_TO.inverse();
    const globalProbe = { x: 30, y: -2, z: 5 };
    const localProbe = SWITCH_TO.toLocalPoint(globalProbe);
    const result = surface.followFunc(localProbe);
    expectPointClose(result.position, d.toGlobalPoint({ x: 30, y: -2, z: 3 }));
    expectPointClose(result.normal, Pnt3.Z);
    // a new function is taken as written for the current frame
    surface.followFunc = p => ({ position: p, normal: Pnt3.Z });
    expectPointClose(surface.followFunc({ x: 1, y: 2, z: 3 }).position, { x: 1, y: 2, z: 3 });
  });

  it("turns a player character controller's look direction with the yaw", () => {
    const keyboard = new KeyboardInput();
    const camera = mockRenderer(mockCamera());
    const controller = new PlayerCharacterController(keyboard, null, camera);
    world.addEntity(camera);
    world.addEntity(controller);
    controller.lookDirection = { x: 1, y: 0, z: 0 };
    world.switchFrame(SWITCH_TO);
    expectPointClose(controller.lookDirection, SWITCH_TO.toLocalDirection({ x: 1, y: 0, z: 0 }));
  });

  it('warns once per class about a positionable entity without the hook, only with the dev console loaded', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    world.addEntity(new PlainPositionable());
    world.switchFrame(SWITCH_TO);
    expect(warn).not.toHaveBeenCalled();
    (window as any).ggstatic = {};
    world.addEntity(new PlainPositionable());
    world.switchFrame(Frame3d.IDENTITY);
    world.switchFrame(SWITCH_TO);
    const messages = warn.mock.calls.map(c => String(c[0])).filter(m => m.includes('PlainPositionable'));
    expect(messages.length).toBe(1);
    expect(messages[0]).toContain('IFrameSwitchable');
  });

  it('a hook-less entity keeps its pose; an app hook receives the delta', () => {
    const plain = new PlainPositionable();
    const received: Frame3d[] = [];
    class AppEntity extends PlainPositionable implements IFrameSwitchable {
      static readonly entityTypeName: string = 'AppEntity';
      onFrameSwitch(delta: Frame3d) {
        received.push(delta);
      }
    }
    world.addEntity(plain);
    world.addEntity(new AppEntity());
    world.switchFrame(SWITCH_TO);
    expect(plain.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(received.length).toBe(1);
  });

  it('switchBodyFrame falls back to setters and moves a component once per delta', () => {
    const body = mock3DBody();
    body.position = { x: 1, y: 0, z: 0 };
    body.linearVelocity = { x: 0, y: 1, z: 0 };
    const delta = new Frame3d({ x: 0, y: 0, z: 0 }, Math.PI / 2);
    switchBodyFrame(body, delta);
    switchBodyFrame(body, delta);
    expectPointClose(body.position, { x: 0, y: 1, z: 0 });
    expectPointClose(body.linearVelocity, { x: -1, y: 0, z: 0 });
    expect(claimFrameSwitch(body, delta)).toBe(false);
    expect(claimFrameSwitch(body, new Frame3d())).toBe(true);
  });
});
