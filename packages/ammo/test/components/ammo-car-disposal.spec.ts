import { takeUntil } from 'rxjs';
import {
  Entity3d,
  Gg3dWorld,
  GgCarEntity,
  GgCarProperties,
  IDisplayObject3dComponent,
  IEntity,
  Pnt3,
  Qtrn,
  RaycastVehicle3dEntity,
  RVEntityProperties,
  RVEntityTractionBias,
  TickOrder,
  Trigger3dEntity,
} from '@gg-web-engine/core';
import Ammo from '../../src/ammo.js/ammo';
import { AmmoRaycastVehicleComponent, AmmoRigidBodyComponent, AmmoWorldComponent } from '../../src';
import { AmmoBodyComponent } from '../../src/components/ammo-body.component';

// Adding, removing and disposing a `GgCarEntity` (with child entities: wheel meshes, entities
// ticking off the car, a raycast-vehicle subclass with extra children) in every order an app
// does it, against the real Ammo WASM build.
//
// A use-after-free or double free in Ammo never throws: an embind call on a freed object reads or
// writes freed WASM memory, and `Ammo.destroy` on an already-destroyed object runs the native
// destructor again. So `Ammo.destroy` is wrapped here: a second destroy of the same object, and
// any method call on a destroyed object, is recorded in `nativeErrors` (and the method call throws).

type DisplayStub = IDisplayObject3dComponent & { added: number; removed: number; disposed: number };

const allDisplayStubs: DisplayStub[] = [];

const displayStub = (): DisplayStub => {
  const stub = {
    position: Pnt3.O,
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
    name: '',
    visible: true,
    added: 0,
    removed: 0,
    disposed: 0,
    addToWorld() {
      stub.added++;
    },
    removeFromWorld() {
      stub.removed++;
    },
    dispose() {
      stub.disposed++;
    },
    clone: () => displayStub(),
    getBoundings: () => ({ min: { x: -1, y: -2, z: -0.5 }, max: { x: 1, y: 2, z: 0.5 } }),
    enableRenderLayer() {},
    disableRenderLayer() {},
    isRenderLayerEnabled: () => true,
  };
  allDisplayStubs.push(stub as unknown as DisplayStub);
  return stub as unknown as DisplayStub;
};

const MASS = 1500;

const carProperties = (): GgCarProperties & RVEntityProperties => ({
  mpsToRpmFactor: 100,
  tractionBias: RVEntityTractionBias.RWD,
  suspension: { stiffness: 40, damping: 5, compression: 3, restLength: 0.3 },
  wheelBase: {
    shared: {
      tyreWidth: 0.25,
      tyreRadius: 0.33,
      frictionSlip: 2.5,
      rollInfluence: 0.2,
      maxTravel: 0.2,
      display: { displayObject: displayStub() },
    },
    front: { halfAxleWidth: 0.8, axlePosition: 1.3, axleHeight: 0 },
    rear: { halfAxleWidth: 0.8, axlePosition: -1.2, axleHeight: 0 },
  },
  engine: {
    minRpm: 1000,
    maxRpm: 6000,
    torques: [
      { rpm: 1000, torque: 300 },
      { rpm: 6000, torque: 300 },
    ],
    maxRpmIncreasePerSecond: 7000,
    maxRpmDecreasePerSecond: 8000,
  },
  transmission: {
    isAuto: true,
    drivelineEfficiency: 0.9,
    reverseGearRatio: -3,
    gearRatios: [3, 2, 1.4, 1],
    finalDriveRatio: 4,
    upShifts: [5500, 5500, 5500, 5500],
    autoHold: true,
  },
  brake: { frontAxleForce: 3000, rearAxleForce: 2500, handbrakeForce: 5000 },
  maxSteerAngle: 0.5,
});

/** A raycast vehicle subclass that adds wheel meshes of its own as children, the way a model-specific car does. */
class ModelVehicle extends RaycastVehicle3dEntity {
  static readonly entityTypeName: string = 'ModelVehicle';
  public readonly extraWheels: Entity3d[];

  constructor(
    carProperties: RVEntityProperties,
    chassis3D: IDisplayObject3dComponent | null,
    vehicleComponent: AmmoRaycastVehicleComponent,
  ) {
    super(carProperties, chassis3D, vehicleComponent);
    this.extraWheels = [0, 1, 2, 3].map(() => new Entity3d({ object3D: displayStub() }));
    this.addChildren(...this.extraWheels);
  }
}

class TestCar extends GgCarEntity<any, ModelVehicle> {
  static readonly entityTypeName: string = 'TestCar';

  protected createRaycastVehicle(
    carProperties: GgCarProperties,
    chassis3D: IDisplayObject3dComponent | null,
    chassisBody: AmmoRaycastVehicleComponent,
  ): ModelVehicle {
    return new ModelVehicle(carProperties, chassis3D, chassisBody);
  }

  get vehicleComponent(): AmmoRaycastVehicleComponent {
    return this.raycastVehicle.vehicleComponent as AmmoRaycastVehicleComponent;
  }
}

/** A child of the car ticking off it, reading wheel contacts and transforms (skid marks, a shadow, a tracker). */
class CarReader extends IEntity {
  static readonly entityTypeName: string = 'CarReader';
  public ticks = 0;

  constructor(public readonly tickOrder: number) {
    super();
  }

  onSpawned(world: any) {
    super.onSpawned(world);
    const car = this.parent as TestCar;
    this.tick$.pipe(takeUntil(this._onRemoved$)).subscribe(() => {
      this.ticks++;
      for (let i = 0; i < car.raycastVehicle.wheelCount('both'); i++) {
        car.vehicleComponent.getWheelContact(i);
        car.vehicleComponent.isWheelTouchesGround(i);
      }
      void car.position;
      void car.rotation;
      void car.vehicleComponent.linearVelocity;
    });
  }
}

/** A child of the car writing its velocity before the physics step (invisible walls, assists). */
class CarWriter extends IEntity {
  static readonly entityTypeName: string = 'CarWriter';
  readonly tickOrder = TickOrder.PHYSICS_SIMULATION - 1;

  onSpawned(world: any) {
    super.onSpawned(world);
    const car = this.parent as TestCar;
    this.tick$.pipe(takeUntil(this._onRemoved$)).subscribe(() => {
      const body = car.vehicleComponent;
      body.linearVelocity = body.linearVelocity;
      body.angularVelocity = body.angularVelocity;
    });
  }
}

/** Calls `action` once, from inside its own tick, after `afterTicks` ticks. */
class TickHook extends IEntity {
  static readonly entityTypeName: string = 'TickHook';
  private count = 0;

  constructor(
    public readonly tickOrder: number,
    private readonly afterTicks: number,
    private readonly action: () => void,
  ) {
    super();
    this.tick$.subscribe(() => {
      if (++this.count === this.afterTicks) {
        this.action();
      }
    });
  }
}

let world: Gg3dWorld;
let physics: AmmoWorldComponent;
let nativeErrors: string[];
let destroyed: Set<object>;
let destroySpy: jest.SpyInstance;

const ammoClassName = (obj: object): string => {
  const proto = Object.getPrototypeOf(obj);
  return Object.keys(Ammo).find(k => (Ammo as any)[k]?.prototype === proto) ?? 'unknown';
};

const watchNativeFrees = () => {
  nativeErrors = [];
  destroyed = new Set();
  const original = (Ammo as any).destroy;
  destroySpy = jest.spyOn(Ammo as any, 'destroy').mockImplementation((obj: any) => {
    const className = ammoClassName(obj);
    if (destroyed.has(obj)) {
      nativeErrors.push(`${className} destroyed twice`);
      return;
    }
    try {
      original(obj);
    } catch (e) {
      // a class without a native destructor binding: the object can't be freed
      nativeErrors.push(`${className} cannot be destroyed: ${e}`);
      throw e;
    }
    destroyed.add(obj);
    let proto = Object.getPrototypeOf(obj);
    while (proto && proto !== Object.prototype) {
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (key === 'constructor' || key === '__destroy__' || typeof proto[key] !== 'function') {
          continue;
        }
        Object.defineProperty(obj, key, {
          configurable: true,
          value: () => {
            const message = `${className}.${key}() called after destroy`;
            nativeErrors.push(message);
            throw new Error(message);
          },
        });
      }
      proto = Object.getPrototypeOf(proto);
    }
  });
};

/** World time in ms */
const step = (ms: number, fps: number = 60) => {
  for (let t = 0; t < ms; t += 1000 / fps) {
    world.worldClock.step(1000 / fps);
  }
};

const spawnCar = (position = { x: 0, y: 0, z: 1.5 }, add: boolean = true): TestCar => {
  const dimensions = { x: 1.8, y: 4.4, z: 0.8 };
  const chassisBody = physics.factory.createRigidBody({
    shape: { shape: 'COMPOUND', children: [{ shape: { shape: 'BOX', dimensions }, position: { x: 0, y: 0, z: 0.3 } }] },
    body: { mass: MASS, bodyType: 'dynamic', friction: 0.5, restitution: 0.3 },
  });
  const car = new TestCar(carProperties(), displayStub(), physics.factory.createRaycastVehicle(chassisBody));
  car.addChildren(
    new CarReader(TickOrder.PHYSICS_SIMULATION - 6),
    new CarWriter(),
    new CarReader(TickOrder.OBJECTS_BINDING + 1),
  );
  car.position = position;
  if (add) {
    world.addEntity(car);
  }
  return car;
};

/** Every entity nested under `entity`, itself included. */
const subtree = (entity: IEntity): IEntity[] => [entity, ...entity.children.flatMap(subtree)];

let baselineChildren: number;
let floor: AmmoRigidBodyComponent;

const expectCarGone = (car: TestCar) => {
  const vehicle = car.vehicleComponent;
  // the chassis is out of the collision world: a ray down through where it was only hits the floor
  const { x, y } = car.position;
  const hit = physics.raycast({ from: { x, y, z: 20 }, to: { x, y, z: -1 } });
  expect(hit.hitBody).toBe(floor);
  for (const entity of subtree(car)) {
    expect(world.children).not.toContain(entity);
    expect(entity.world).toBeNull();
    expect(entity.disposed).toBe(true);
  }
  expect(physics.children.length).toBe(baselineChildren);
  expect(physics.raycastVehicles.has(vehicle)).toBe(false);
  for (const handle of [vehicle.nativeVehicle, (vehicle as any).raycaster, vehicle.nativeBody]) {
    expect(destroyed.has(handle)).toBe(true);
  }
  expect([...AmmoBodyComponent.nativeBodyReverseMap.values()]).not.toContain(vehicle);
  expect(nativeErrors).toEqual([]);
};

const expectDisplayStubsBalanced = () => {
  for (const stub of allDisplayStubs) {
    expect(stub.removed).toBe(stub.added);
  }
};

/** Height the car's chassis rests at on the floor: a fresh car must reach it the same way after every disposal. */
let restingHeight: number;

const expectFreshCarDrives = () => {
  const car = spawnCar({ x: 10, y: 0, z: 1.5 });
  step(3000);
  expect(car.position.z).toBeCloseTo(restingHeight, 3);
  expect(car.raycastVehicle.isTouchingGround).toBe(true);
  car.gear = 1;
  car.acceleration = 1;
  step(2000);
  expect(car.vehicleComponent.linearVelocity.y).toBeGreaterThan(3);
  expect(Pnt3.len(car.vehicleComponent.angularVelocity)).toBeLessThan(0.5);
  world.removeEntity(car, true);
  expectCarGone(car);
};

/** A world with a static floor plane, its clock paused for `step()` */
const createWorld = async () => {
  allDisplayStubs.length = 0;
  physics = new AmmoWorldComponent();
  world = new Gg3dWorld({ physicsWorld: physics as any });
  await world.init();
  world.worldClock.start();
  world.worldClock.pause();
  physics.gravity = { x: 0, y: 0, z: -9.82 };
  floor = physics.factory.createRigidBody({ shape: { shape: 'PLANE' }, body: { bodyType: 'static', mass: 0 } });
  world.addEntity(new Entity3d({ objectBody: floor }));
  baselineChildren = physics.children.length;
};

let worldDisposed: boolean;

beforeAll(async () => {
  await createWorld();
  const car = spawnCar({ x: 10, y: 0, z: 1.5 });
  step(3000);
  restingHeight = car.position.z;
  world.dispose();
});

beforeEach(async () => {
  await createWorld();
  worldDisposed = false;
  watchNativeFrees();
});

afterEach(() => {
  if (!worldDisposed) {
    world.dispose();
  }
  destroySpy.mockRestore();
});

describe('GgCarEntity disposal on Ammo', () => {
  it('disposes a car while it is spawned', () => {
    const car = spawnCar();
    step(1000);
    car.dispose();
    expectCarGone(car);
    step(500);
    expectDisplayStubsBalanced();
    expectFreshCarDrives();
  });

  it('disposes a car after removing it', () => {
    const car = spawnCar();
    step(1000);
    world.removeEntity(car);
    step(500);
    car.dispose();
    expectCarGone(car);
    expectFreshCarDrives();
  });

  it('disposes a car with removeEntity(car, true)', () => {
    const car = spawnCar();
    step(1000);
    world.removeEntity(car, true);
    expectCarGone(car);
    expectFreshCarDrives();
  });

  it('disposes a car from its own onRemoved$, as a car loader does', () => {
    for (const once of [true, false]) {
      const car = spawnCar();
      const sub = car.onRemoved$.subscribe(() => {
        if (once) {
          sub.unsubscribe();
        }
        car.dispose();
      });
      step(1000);
      world.removeEntity(car);
      expectCarGone(car);
      step(500);
    }
    expectFreshCarDrives();
  });

  it('survives disposing a car twice, and removing it with dispose twice', () => {
    const car = spawnCar();
    step(1000);
    car.dispose();
    car.dispose();
    world.removeEntity(car, true);
    world.removeEntity(car, true);
    expectCarGone(car);
    const other = spawnCar();
    step(1000);
    world.removeEntity(other, true);
    other.dispose();
    world.removeEntity(other, true);
    expectCarGone(other);
    expectFreshCarDrives();
  });

  it('refuses to add a disposed car again', () => {
    const car = spawnCar();
    step(500);
    world.removeEntity(car, true);
    expect(() => world.addEntity(car)).toThrow();
    expectCarGone(car);
    expectFreshCarDrives();
  });

  it('disposes a car that was never spawned', () => {
    const car = spawnCar(undefined, false);
    car.dispose();
    expect(physics.raycastVehicles.size).toBe(0);
    expect(nativeErrors).toEqual([]);
    expectFreshCarDrives();
  });

  it.each([
    ['before the physics step, from an entity of the world', TickOrder.PHYSICS_SIMULATION - 10, false],
    ['after the physics step, from an entity of the world', TickOrder.OBJECTS_BINDING - 10, false],
    ['before the physics step, from a child of the car', TickOrder.PHYSICS_SIMULATION - 10, true],
    ['after the physics step, from a child of the car', TickOrder.RENDERING, true],
  ])('disposes a car during a tick: %s', (_, tickOrder, asChild) => {
    const car = spawnCar();
    const hook = new TickHook(tickOrder, 30, () => car.dispose());
    if (asChild) {
      car.addChildren(hook);
    } else {
      world.addEntity(hook);
    }
    step(1000);
    expectCarGone(car);
    step(500);
    expectFreshCarDrives();
  });

  it('disposes a car from its own tick$ subscriber', () => {
    const car = spawnCar();
    let ticks = 0;
    car.tick$.subscribe(() => {
      if (++ticks === 30) {
        world.removeEntity(car, true);
      }
    });
    step(1000);
    expectCarGone(car);
    expectFreshCarDrives();
  });

  it('respawns cars many times, next to a car that stays', () => {
    const stays = spawnCar({ x: -10, y: 0, z: 1.5 });
    baselineChildren = physics.children.length;
    step(3000);
    const restingPosition = stays.position;
    for (let i = 0; i < 20; i++) {
      const car = spawnCar({ x: 0, y: i % 2 ? 5 : -5, z: 1.5 });
      car.acceleration = 1;
      car.steeringFactor = i % 3 ? 0.5 : -0.5;
      step(300 + i * 37);
      switch (i % 4) {
        case 0:
          car.dispose();
          break;
        case 1:
          world.removeEntity(car, true);
          break;
        case 2:
          world.removeEntity(car);
          step(100);
          car.dispose();
          break;
        case 3:
          car.onRemoved$.subscribe(() => car.dispose());
          world.removeEntity(car);
          break;
      }
      expectCarGone(car);
      expect(Pnt3.dist(stays.position, restingPosition)).toBeLessThan(0.01);
    }
    expectFreshCarDrives();
  });

  it('removes and re-adds a car (without disposing it) many times, then disposes it', () => {
    const car = spawnCar();
    for (let i = 0; i < 10; i++) {
      step(500);
      world.removeEntity(car);
      expect(physics.raycastVehicles.size).toBe(0);
      step(100);
      car.resetTo({ position: { x: 0, y: 0, z: 1.5 } });
      world.addEntity(car);
    }
    step(3000);
    expect(car.position.z).toBeCloseTo(restingHeight, 3);
    world.removeEntity(car, true);
    expectCarGone(car);
    expectFreshCarDrives();
  });

  it('disposes a car while it is inside a trigger, reporting it as left', async () => {
    const trigger = new Trigger3dEntity(
      physics.factory.createTrigger({ shape: 'BOX', dimensions: { x: 20, y: 20, z: 10 } }),
    );
    world.addEntity(trigger);
    baselineChildren = physics.children.length;
    const entered: unknown[] = [];
    const left: unknown[] = [];
    trigger.onEntityEntered.subscribe(e => entered.push(e));
    trigger.onEntityLeft.subscribe(e => left.push(e));
    const car = spawnCar();
    step(1000);
    // the floor plane is inside the trigger too
    expect(entered).toContain(car.raycastVehicle);
    world.removeEntity(car, true);
    await Promise.resolve();
    expect(left.length).toBe(1);
    expect(left[0]).toBe(car.raycastVehicle);
    step(500);
    expect(left.length).toBe(1);
    expectCarGone(car);
    expectFreshCarDrives();
  });

  it('disposes a car from its own collision event', () => {
    // dropped on its side, so the chassis (not the wheels) hits the floor
    const car = spawnCar({ x: 0, y: 0, z: 3 });
    car.rotation = Qtrn.fromAngle(Pnt3.Y, Math.PI / 2);
    let collisions = 0;
    car.vehicleComponent.onCollisionStart.subscribe(() => {
      collisions++;
      car.dispose();
    });
    const floorCollisions: unknown[] = [];
    floor.onCollisionStart.subscribe(e => floorCollisions.push(e.otherBody));
    step(2000);
    expect(collisions).toBe(1);
    expect(floorCollisions.length).toBe(1);
    expect(floorCollisions[0]).toBe(car.vehicleComponent);
    expectCarGone(car);
    expectFreshCarDrives();
  });

  it('disposes the world with a car still spawned, the car disposing itself from onRemoved$', () => {
    const car = spawnCar();
    car.onRemoved$.subscribe(() => car.dispose());
    const parked = spawnCar({ x: 10, y: 0, z: 1.5 });
    step(1000);
    world.dispose();
    worldDisposed = true;
    for (const c of [car, parked]) {
      for (const entity of subtree(c)) {
        expect(entity.disposed).toBe(true);
      }
      expect(destroyed.has(c.vehicleComponent.nativeVehicle)).toBe(true);
    }
    expect(nativeErrors).toEqual([]);
    expectDisplayStubsBalanced();
    // every display object that was spawned (not the wheel template, which the vehicle clones)
    for (const stub of allDisplayStubs.filter(s => s.added > 0)) {
      expect(stub.disposed).toBe(1);
    }
  });
});
