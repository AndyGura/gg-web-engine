import { Subject } from 'rxjs';
import { mockCarProperties, mockRaycastVehicle } from '../../mocks/raycast-vehicle.mock';
import {
  CollisionEvent,
  Entity3d,
  Gg3dWorldTypeDocRepo,
  IRaycastVehicleComponent,
  IRigidBody3dComponent,
  Point3,
  Point4,
  Qtrn,
  RaycastVehicle3dEntity,
  RaycastVehicleImpact,
  RaycastVehicleLanding,
  RVEntityWheelEntity,
  RVEntityWheelFullOptions,
  WheelContact,
} from '../../../src';
import { mock3DObject } from '../../mocks/object.mock';
import { mock3DBody } from '../../mocks/body.mock';
import { MockWorld } from '../../mocks/world.mock';

describe(`Gg3dRaycastVehicleEntity`, () => {
  describe(`visible`, () => {
    it(`should hide wheels when car is hidden`, () => {
      const car = new RaycastVehicle3dEntity(mockCarProperties(), mock3DObject(), mockRaycastVehicle());
      for (const wheel of (car as any).wheels) {
        expect(wheel.worldVisible).toBeTruthy();
      }
      car.visible = false;
      for (const wheel of (car as any).wheels) {
        expect(wheel.worldVisible).toBeFalsy();
      }
    });
  });

  // a vehicle whose wheels touch the ground while `ground.touching` is true, with `ground.normal`
  type MockVehicle = IRaycastVehicleComponent & { onCollisionStart: Subject<CollisionEvent<Point3, any>> };
  const spawnCar = (ground = { touching: true, normal: { x: 0, y: 0, z: 1 } as Point3 }) => {
    const vehicle = mockRaycastVehicle() as MockVehicle;
    vehicle.isWheelTouchesGround = () => ground.touching;
    vehicle.getWheelContact = (): WheelContact | null =>
      ground.touching
        ? {
            point: { x: 0, y: 0, z: 0 },
            normal: ground.normal,
            axle: { x: 1, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            sideSlipSpeed: 0,
            suspensionForce: 0,
            skid: 1,
          }
        : null;
    vehicle.resetMotion = () => {};
    // no wheel meshes: only the vehicle component is spawned
    const properties = mockCarProperties();
    (properties as any).wheelBase.shared.display = undefined;
    const car = new RaycastVehicle3dEntity(properties, null, vehicle);
    const world = new MockWorld();
    world.addEntity(car);
    const impacts: RaycastVehicleImpact[] = [];
    const landings: RaycastVehicleLanding[] = [];
    let airborne = 0;
    car.impact$.subscribe(x => impacts.push(x));
    car.landed$.subscribe(x => landings.push(x));
    car.airborne$.subscribe(() => airborne++);
    return { car, vehicle, world, ground, impacts, landings, airborne: () => airborne };
  };
  let time = 0;
  // the tick after a physics step: the entity reads the wheels and samples the velocities
  const tick = (car: RaycastVehicle3dEntity, dt = 1000 / 60) => {
    time += dt;
    car.tick$.next([time, dt]);
  };
  const hit = (
    vehicle: MockVehicle,
    otherBody: IRigidBody3dComponent,
    normal: Point3,
    position: Point3 = { x: 0, y: 0, z: 0 },
  ) =>
    vehicle.onCollisionStart.next({ otherBody, position, normal, relativeVelocity: { x: 0, y: 0, z: 0 }, impulse: 7 });

  describe('impact$', () => {
    it('reports the approach speed along the normal from the velocity before the step', () => {
      const { car, vehicle, impacts } = spawnCar();
      vehicle.linearVelocity = { x: 10, y: 3, z: 0 };
      tick(car);
      // the step resolves the hit before the collision event fires
      vehicle.linearVelocity = { x: 1, y: 3, z: 0 };
      const wall = mock3DBody();
      hit(vehicle, wall, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 });
      expect(impacts.length).toBe(1);
      expect(impacts[0].speed).toBeCloseTo(10);
      expect(impacts[0].otherBody).toBe(wall);
      expect(impacts[0].entity).toBeNull();
      expect(impacts[0].position).toEqual({ x: 2, y: 0, z: 0 });
      expect(impacts[0].normal).toEqual({ x: 1, y: 0, z: 0 });
      expect(impacts[0].impulse).toBe(7);
      expect(impacts[0].mirrored).toBe(false);
    });

    it('adds the spin of the chassis at the contact point', () => {
      const { car, vehicle, impacts } = spawnCar();
      // 2 rad/s around +Z: a point 1.5 m ahead (+Y) of the centre moves towards -X at 3 m/s
      vehicle.angularVelocity = { x: 0, y: 0, z: 2 };
      tick(car);
      vehicle.angularVelocity = { x: 0, y: 0, z: 0 };
      hit(vehicle, mock3DBody(), { x: -1, y: 0, z: 0 }, { x: 0, y: 1.5, z: 0 });
      expect(impacts[0].speed).toBeCloseTo(3);
    });

    it('never reports a negative speed for bodies moving apart', () => {
      const { car, vehicle, impacts } = spawnCar();
      vehicle.linearVelocity = { x: -4, y: 0, z: 0 };
      tick(car);
      hit(vehicle, mock3DBody(), { x: 1, y: 0, z: 0 });
      expect(impacts[0].speed).toBe(0);
    });

    it('takes the current velocity of a body that is not a vehicle', () => {
      const { car, vehicle, impacts } = spawnCar();
      vehicle.linearVelocity = { x: 10, y: 0, z: 0 };
      tick(car);
      const prop = mock3DBody();
      prop.linearVelocity = { x: 4, y: 0, z: 0 };
      hit(vehicle, prop, { x: 1, y: 0, z: 0 });
      expect(impacts[0].speed).toBeCloseTo(6);
    });

    it('reports a hit between two vehicles on both, with the same speed, the second one mirrored', () => {
      const a = spawnCar();
      const b = spawnCar();
      a.vehicle.linearVelocity = { x: 5, y: 0, z: 0 };
      b.vehicle.linearVelocity = { x: -7, y: 0, z: 0 };
      tick(a.car);
      tick(b.car);
      // both bounce back before the events fire
      a.vehicle.linearVelocity = { x: -1, y: 0, z: 0 };
      b.vehicle.linearVelocity = { x: 1, y: 0, z: 0 };
      hit(a.vehicle, b.vehicle, { x: 1, y: 0, z: 0 });
      hit(b.vehicle, a.vehicle, { x: -1, y: 0, z: 0 });
      expect(a.impacts.length).toBe(1);
      expect(b.impacts.length).toBe(1);
      expect(a.impacts[0].speed).toBeCloseTo(12);
      expect(b.impacts[0].speed).toBeCloseTo(12);
      expect(a.impacts[0].entity).toBe(b.car);
      expect(b.impacts[0].entity).toBe(a.car);
      expect(a.impacts[0].mirrored).toBe(false);
      expect(b.impacts[0].mirrored).toBe(true);

      // a later hit of the same pair: whichever vehicle reports first is not mirrored
      tick(a.car);
      tick(b.car);
      hit(b.vehicle, a.vehicle, { x: -1, y: 0, z: 0 });
      hit(a.vehicle, b.vehicle, { x: 1, y: 0, z: 0 });
      expect(b.impacts[1].mirrored).toBe(false);
      expect(a.impacts[1].mirrored).toBe(true);
    });

    it('stops reporting once removed, and reports once per hit after being added again', () => {
      const { car, vehicle, world, impacts } = spawnCar();
      world.removeEntity(car);
      hit(vehicle, mock3DBody(), { x: 1, y: 0, z: 0 });
      expect(impacts.length).toBe(0);
      world.addEntity(car);
      hit(vehicle, mock3DBody(), { x: 1, y: 0, z: 0 });
      expect(impacts.length).toBe(1);
    });

    it('completes on dispose', () => {
      const { car } = spawnCar();
      let completed = false;
      car.impact$.subscribe({ complete: () => (completed = true) });
      car.dispose();
      expect(completed).toBe(true);
    });
  });

  describe('airborne$ / landed$', () => {
    it('ignores the wheels leaving the ground for less than airborneDelay', () => {
      const { car, ground, landings, airborne } = spawnCar();
      ground.touching = false;
      // 200 ms
      for (let i = 0; i < 12; i++) tick(car);
      expect(car.isAirborne).toBe(false);
      ground.touching = true;
      tick(car);
      expect(airborne()).toBe(0);
      expect(landings.length).toBe(0);
    });

    it('becomes airborne once every wheel was off the ground for airborneDelay, and reports the landing', () => {
      const { car, vehicle, ground, landings, airborne } = spawnCar();
      ground.touching = false;
      for (let i = 0; i < 14; i++) tick(car);
      expect(car.isAirborne).toBe(false);
      tick(car); // 250 ms
      expect(car.isAirborne).toBe(true);
      expect(airborne()).toBe(1);
      for (let i = 0; i < 45; i++) tick(car); // 1 s in the air
      expect(airborne()).toBe(1);
      vehicle.linearVelocity = { x: 20, y: 0, z: -6 };
      tick(car);
      // the touchdown step has slowed the fall already
      vehicle.linearVelocity = { x: 20, y: 0, z: -1 };
      ground.touching = true;
      tick(car);
      expect(car.isAirborne).toBe(false);
      expect(landings.length).toBe(1);
      expect(landings[0].speed).toBeCloseTo(6);
      expect(landings[0].airTime).toBeCloseTo((61 * 1000) / 60);
      tick(car);
      expect(landings.length).toBe(1);
    });

    it('measures the landing speed along the ground normal', () => {
      const ground = { touching: false, normal: { x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 } };
      const { car, vehicle, landings } = spawnCar(ground);
      vehicle.linearVelocity = { x: -4, y: 0, z: -4 };
      for (let i = 0; i < 20; i++) tick(car);
      ground.touching = true;
      tick(car);
      expect(landings[0].speed).toBeCloseTo(4 * Math.SQRT2);
    });

    it('takes airborneDelay in world time, whatever the frame rate', () => {
      for (const fps of [30, 144]) {
        const { car, ground } = spawnCar();
        car.airborneDelay = 100;
        ground.touching = false;
        let ticks = 0;
        while (!car.isAirborne) {
          tick(car, 1000 / fps);
          ticks++;
        }
        expect(ticks).toBe(Math.ceil((100 * fps) / 1000 - 1e-9));
      }
    });

    it('ends the airborne state on resetTo without a landing', () => {
      const { car, ground, landings } = spawnCar();
      ground.touching = false;
      for (let i = 0; i < 20; i++) tick(car);
      expect(car.isAirborne).toBe(true);
      car.resetTo({ position: { x: 0, y: 0, z: 1 } });
      expect(car.isAirborne).toBe(false);
      ground.touching = true;
      tick(car);
      expect(landings.length).toBe(0);
    });
  });

  describe(`createWheelEntity`, () => {
    const turn: Point4 = Qtrn.fromAngle({ x: 0, y: 0, z: 1 }, Math.PI / 2);

    class OwnWheelsVehicle extends RaycastVehicle3dEntity {
      static seen: [RVEntityWheelFullOptions, number][] = [];

      // front wheels only, each an entity of the subclass's own making
      protected createWheelEntity(
        options: RVEntityWheelFullOptions,
        index: number,
      ): RVEntityWheelEntity<Gg3dWorldTypeDocRepo> | null {
        OwnWheelsVehicle.seen.push([options, index]);
        return options.isFront ? { entity: new Entity3d({ object3D: mock3DObject() }), localRotation: turn } : null;
      }
    }

    it(`by default clones the display object of each wheel, named after the vehicle`, () => {
      const car = new RaycastVehicle3dEntity(mockCarProperties(), mock3DObject(), mockRaycastVehicle());
      const wheels = (car as any).wheels as Entity3d[];
      expect(wheels.map(w => w.name.replace(car.name, ''))).toEqual([
        '__wheel_fl',
        '__wheel_fr',
        '__wheel_rl',
        '__wheel_rr',
      ]);
      expect(car.children).toEqual(wheels);
    });

    it(`lets a subclass supply its own wheel entities, which the vehicle names, adopts and moves`, () => {
      OwnWheelsVehicle.seen = [];
      const vehicle = mockRaycastVehicle();
      (vehicle as any).getWheelTransform = (i: number) => ({
        position: { x: i, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
      });
      const car = new OwnWheelsVehicle(mockCarProperties(), mock3DObject(), vehicle);
      expect(OwnWheelsVehicle.seen.map(([options, index]) => [options.isFront, options.isLeft, index])).toEqual([
        [true, true, 0],
        [true, false, 1],
        [false, true, 2],
        [false, false, 3],
      ]);
      const wheels = (car as any).wheels as (Entity3d | null)[];
      expect(wheels[2]).toBeNull();
      expect(wheels[3]).toBeNull();
      expect(car.children).toEqual([wheels[0], wheels[1]]);
      expect(wheels[0]!.name).toBe(car.name + '__wheel_fl');

      car.name = 'Car';
      expect(wheels[1]!.name).toBe('Car__wheel_fr');

      (car as any).runTransformBinding(vehicle, car.object3D);
      expect(wheels[1]!.position).toEqual({ x: 1, y: 0, z: 0 });
      expect(wheels[1]!.rotation).toEqual({
        x: expect.closeTo(turn.x),
        y: expect.closeTo(turn.y),
        z: expect.closeTo(turn.z),
        w: expect.closeTo(turn.w),
      });
    });
  });
});
