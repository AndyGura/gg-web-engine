import { mockCarProperties, mockRaycastVehicle } from '../../mocks/raycast-vehicle.mock';
import { DEFAULT_CORRECTION_TUNING, GgCarEntity, isNetworkInputDriven, isNetworkSyncable } from '../../../src';
import { MockWorld } from '../../mocks/world.mock';
import { mock3DObject } from '../../mocks/object.mock';

describe(`GgCarEntity`, () => {
  describe(`steeringFactor`, () => {
    it(`applies a plain-number maxSteerAngle unconditionally of speed`, () => {
      const car = new GgCarEntity(
        { ...mockCarProperties(), maxSteerAngle: 0.35 },
        mock3DObject(),
        mockRaycastVehicle(),
      );

      for (const speed of [0, 5, 17.5, 30, 100]) {
        jest.spyOn(car.raycastVehicle, 'getSpeed').mockReturnValue(speed);
        car.steeringFactor = 1;
        expect(car.raycastVehicle.steeringAngle).toBeCloseTo(0.35);
        expect(car.steeringFactor).toBeCloseTo(1);
      }
    });

    it(`linearly tapers the effective max angle between breakpoints, clamped outside their range`, () => {
      const car = new GgCarEntity(
        {
          ...mockCarProperties(),
          maxSteerAngle: [
            { atSpeedMs: 5, angleRad: 0.2 },
            { atSpeedMs: 30, angleRad: 0.06 },
          ],
        },
        mock3DObject(),
        mockRaycastVehicle(),
      );

      const expectAngleAtSpeed = (speed: number, expectedAngle: number) => {
        jest.spyOn(car.raycastVehicle, 'getSpeed').mockReturnValue(speed);
        car.steeringFactor = 1;
        expect(car.raycastVehicle.steeringAngle).toBeCloseTo(expectedAngle);
      };

      // below the first breakpoint: clamped to its angle
      expectAngleAtSpeed(0, 0.2);
      expectAngleAtSpeed(5, 0.2);
      // between breakpoints: linear taper
      expectAngleAtSpeed(17.5, 0.13); // halfway between 5 and 30 m/s
      // at/above the last breakpoint: clamped to its angle
      expectAngleAtSpeed(30, 0.06);
      expectAngleAtSpeed(100, 0.06);

      // negative speed (reversing) uses the same |speed| authority curve
      expectAngleAtSpeed(-17.5, 0.13);
    });
  });

  describe(`serializeSettings`, () => {
    it(`captures construction-time tuning, chassis geometry, and current driving state`, () => {
      const chassis3D = { ...mock3DObject(), materialOptions: { color: 8947848 } };
      const chassisBody = mockRaycastVehicle({ shape: 'BOX', dimensions: { x: 1.8, y: 4, z: 0.6 } });
      const car = new GgCarEntity(mockCarProperties(), chassis3D as any, chassisBody);

      car.gear = 2;
      car.acceleration = 0.75;
      car.brake = 0.1;
      car.handBrake = true;
      car.steeringFactor = 0.5;

      const { config } = car.serializeSettings();
      const carProperties = mockCarProperties();

      expect(config.chassis).toEqual({
        dimensions: { x: 1.8, y: 4, z: 0.6 },
        material: { color: 8947848 },
        body: chassisBody.bodyOptions,
      });
      expect(config.engine).toEqual(carProperties.engine);
      expect(config.brake).toEqual(carProperties.brake);
      expect(config.transmission).toEqual(carProperties.transmission);
      expect(config.suspension).toEqual(carProperties.suspension);
      expect(config.tractionBias).toEqual(carProperties.tractionBias);
      expect(config.maxSteerAngle).toEqual(carProperties.maxSteerAngle);
      expect(config.mpsToRpmFactor).toEqual(carProperties.mpsToRpmFactor);
      // "shared"'s live displayObject can't round-trip through JSON - only its other fields do
      expect(config.wheelBase.shared).toEqual({
        tyreWidth: 1,
        tyreRadius: 1,
        frictionSlip: 0,
        rollInfluence: 0,
        maxTravel: 0,
      });
      expect(config.wheelBase.front).toEqual({ halfAxleWidth: 1, axleHeight: 0, axlePosition: 1 });
      expect(config.wheelBase.rear).toEqual({ halfAxleWidth: 1, axleHeight: 0, axlePosition: -1 });
      expect(config.state).toEqual({
        gear: 2,
        acceleration: 0.75,
        brake: 0.1,
        handBrake: true,
        steeringFactor: 0.5,
      });
    });

    it(`omits material when the chassis mesh doesn't implement IMaterialReadable3dComponent`, () => {
      const car = new GgCarEntity(mockCarProperties(), mock3DObject(), mockRaycastVehicle());

      const { config } = car.serializeSettings();

      expect(config.chassis.material).toBeUndefined();
    });
  });

  describe(`drivetrain`, () => {
    const drivingCar = (patch: (props: ReturnType<typeof mockCarProperties>) => void = () => {}, speed = 10) => {
      const props = mockCarProperties();
      patch(props);
      const vehicle = mockRaycastVehicle();
      const car = new GgCarEntity(props, mock3DObject(), vehicle);
      new MockWorld().addEntity(car);
      car.autoShiftEnabled = false;
      jest.spyOn(car.raycastVehicle, 'getSpeed').mockReturnValue(speed);
      const engineForce = jest.spyOn(vehicle, 'applyEngineForce');
      // the sum of the last engine force set on every wheel
      const totalForce = () => {
        const last = new Map<number, number>();
        engineForce.mock.calls.forEach(([wheel, force]) => last.set(wheel, force));
        return [...last.values()].reduce((a, b) => a + b, 0);
      };
      return { car, vehicle, engineForce, totalForce };
    };

    it(`pushes the whole car by tractionForce, split by tractionBias and over each axle's wheels (regression: the force went to every driven wheel)`, () => {
      const { car, totalForce, engineForce } = drivingCar(p => (p.tractionBias = 0.4));
      car.gear = 1;
      car.acceleration = 1;
      car.tick$.next([1000, 1000]);
      const tractionForce = (car as any).tractionForce as number;
      expect(tractionForce).toBeGreaterThan(0);
      expect(totalForce()).toBeCloseTo(tractionForce, 6);
      const perWheel = engineForce.mock.calls.map(([_, f]) => f).filter(f => f > 0);
      expect(perWheel).toHaveLength(4);
      expect(Math.max(...perWheel)).toBeCloseTo((tractionForce * 0.6) / 2, 6);
      expect(Math.min(...perWheel)).toBeCloseTo((tractionForce * 0.4) / 2, 6);
    });

    it(`applies no drive force in neutral`, () => {
      const { car, totalForce } = drivingCar(p => (p.transmission.autoHold = false));
      car.acceleration = 1;
      car.tick$.next([1000, 1000]);
      expect(totalForce()).toBe(0);
    });

    it(`brakes with the over-rev force above redline, or coasts under engine braking with overRevBrakeForce 0`, () => {
      // 30 m/s in 1st: 30 * 104 * 2.92 = 9110 rpm, past the 7240 redline
      const limited = drivingCar(() => {}, 30);
      limited.car.gear = 1;
      limited.car.acceleration = 1;
      limited.car.tick$.next([1000, 1000]);
      expect(limited.totalForce()).toBeCloseTo(-24000, 6);

      const cut = drivingCar(p => (p.engine.overRevBrakeForce = 0), 30);
      cut.car.gear = 1;
      cut.car.acceleration = 1;
      cut.car.tick$.next([1000, 1000]);
      expect(cut.totalForce()).toBeCloseTo(1 * (700 - 30 * 104 * 2.92), 6);
    });

    it(`engine-brakes by a force per rpm by default, or by a drivetrain-scaled torque with brakingTorquePer1000Rpm`, () => {
      const perRpm = drivingCar(p => (p.engine.brakingForcePerRpm = 2));
      perRpm.car.gear = 1;
      perRpm.car.tick$.next([1000, 1000]);
      expect(perRpm.totalForce()).toBeCloseTo(2 * (700 - 10 * 104 * 2.92), 6);

      const torque = drivingCar(p => (p.engine.brakingTorquePer1000Rpm = 50));
      torque.car.gear = 1;
      torque.car.tick$.next([1000, 1000]);
      const rpm = 10 * 104 * 2.92;
      const expected = (-(50 * (rpm - 700)) / 1000) * ((2.92 * 3.21 * 0.85) / 1);
      expect(torque.totalForce()).toBeCloseTo(expected, 6);
    });

    it(`multiplies the drive force by the gear's own efficiency`, () => {
      const plain = drivingCar();
      const efficient = drivingCar(p => (p.transmission.gearEfficiencies = [0.5]));
      for (const { car } of [plain, efficient]) {
        car.gear = 1;
        car.acceleration = 1;
        car.tick$.next([1000, 1000]);
      }
      expect(efficient.totalForce()).toBeCloseTo(plain.totalForce() * 0.5, 6);
    });

    it(`disconnects the engine for shiftTime ms of world time after a gear change, cutting the throttle meanwhile`, () => {
      const { car, totalForce } = drivingCar(p => (p.transmission.shiftTime = 300));
      car.acceleration = 1;
      car.gear = 1;
      expect(car.isShifting).toBe(true);
      car.tick$.next([100, 100]);
      expect(car.isShifting).toBe(true);
      expect(totalForce()).toBe(0);
      expect(car.engineRpm).toBe(700); // throttle cut: no revving in neutral-like state
      car.tick$.next([300, 200]);
      expect(car.isShifting).toBe(false);
      expect(totalForce()).toBeGreaterThan(0);
      car.gear = 0;
      expect(car.isShifting).toBe(false); // shifting into neutral is instant
    });

    it(`holds a downshift back by downshiftMargin rpm`, () => {
      // 4500 rpm in 2nd projects to 7027 rpm in 1st: under the 7140 upshift point, so 1st is chosen
      // without a margin, but not with a 200 rpm one
      const speed = 4500 / (104 * 1.87);
      for (const [margin, expectedGear] of [
        [0, 1],
        [200, 2],
      ]) {
        const { car } = drivingCar(p => (p.transmission.downshiftMargin = margin), speed);
        car.autoShiftEnabled = true;
        car.gear = 2;
        car.tick$.next([1000, 1000]);
        expect(car.gear).toBe(expectedGear);
      }
    });

    it(`doesn't auto-shift while a gear change is in progress`, () => {
      const { car } = drivingCar(p => (p.transmission.shiftTime = 500), 40);
      car.autoShiftEnabled = true;
      car.gear = 1;
      car.tick$.next([100, 100]);
      expect(car.gear).toBe(1);
      car.tick$.next([1000, 900]);
      expect(car.gear).toBeGreaterThan(1);
    });

    it(`applies air drag and rolling resistance to the chassis as forces`, () => {
      const { car, vehicle } = drivingCar(p => {
        p.aerodynamics = { dragCoefficient: 0.3, frontalArea: 2 };
        p.rollingResistance = 0.015;
      });
      vehicle.linearVelocity = { x: 0, y: 20, z: 0 };
      const applyForce = jest.spyOn(vehicle, 'applyForce');
      car.tick$.next([16, 16]);
      expect(applyForce).toHaveBeenCalledTimes(2);
      const drag = applyForce.mock.calls[0][0];
      expect(drag.x).toBeCloseTo(0, 9);
      expect(drag.y).toBeCloseTo(-0.5 * 1.225 * 0.3 * 2 * 400, 6);
      const rolling = applyForce.mock.calls[1][0];
      expect(rolling.y).toBeCloseTo(-0.015 * 1 * 9.82, 6); // mock chassis mass is 1 kg, no world gravity
    });

    it(`applies neither resistance unless configured`, () => {
      const { car, vehicle } = drivingCar();
      vehicle.linearVelocity = { x: 0, y: 20, z: 0 };
      const applyForce = jest.spyOn(vehicle, 'applyForce');
      car.tick$.next([16, 16]);
      expect(applyForce).not.toHaveBeenCalled();
    });

    it(`retunes an axle's grip through the vehicle component`, () => {
      const { car, vehicle } = drivingCar();
      const setGrip = jest.spyOn(vehicle, 'setWheelFrictionSlip');
      car.raycastVehicle.setFrictionSlip('rear', 0.5);
      expect(setGrip).toHaveBeenCalledTimes(2);
      expect(setGrip.mock.calls.every(([_, v]) => v === 0.5)).toBe(true);
      expect(car.raycastVehicle.wheelCount('both')).toBe(4);
    });
  });

  describe(`network contracts`, () => {
    const spawnedCar = () => {
      const car = new GgCarEntity(mockCarProperties(), mock3DObject(), mockRaycastVehicle());
      const world = new MockWorld();
      world.addEntity(car);
      jest.spyOn(car.raycastVehicle, 'getSpeed').mockReturnValue(40);
      return car;
    };

    it(`implements INetworkSyncable and INetworkInputDriven`, () => {
      const car = new GgCarEntity(mockCarProperties(), mock3DObject(), mockRaycastVehicle());
      expect(isNetworkSyncable(car)).toBe(true);
      expect(isNetworkInputDriven(car)).toBe(true);
      expect(car.isNetworkSyncEnabled).toBe(true);
    });

    it(`auto-shifts by default`, () => {
      const car = spawnedCar();
      car.gear = 1;
      car.tick$.next([1000, 1000]);
      expect(car.gear).toBeGreaterThan(1);
    });

    it(`reconsiders the gear every 50 ms of world time, at any frame rate (regression: a wall-clock throttleTime)`, () => {
      for (const fps of [30, 60, 144]) {
        const car = spawnedCar();
        car.gear = 1;
        // the engine model reads engineRpm once a tick, a gear check once more
        const rpmReads = jest.spyOn(car, 'engineRpm', 'get');
        for (let i = 0; i < fps; i++) {
          car.tick$.next([(i * 1000) / fps, 1000 / fps]);
        }
        const checks = rpmReads.mock.calls.length - fps;
        expect(checks).toBeGreaterThanOrEqual(19);
        expect(checks).toBeLessThanOrEqual(21);
      }
    });

    it(`skips auto-shifting while autoShiftEnabled is false`, () => {
      const car = spawnedCar();
      car.autoShiftEnabled = false;
      car.gear = 1;
      car.tick$.next([1000, 1000]);
      expect(car.gear).toBe(1);
    });

    it(`suspends auto-shifting while driven by remote input, and resumes on local capture`, () => {
      const car = spawnedCar();
      car.applyRemoteInput({ steeringFactor: 0, acceleration: 1, brake: 0, gear: 1, handBrake: false });
      car.tick$.next([1000, 1000]);
      expect(car.gear).toBe(1);
      car.captureLocalInput();
      car.tick$.next([2000, 1000]);
      expect(car.gear).toBeGreaterThan(1);
    });

    it(`applies neutral input on null`, () => {
      const car = new GgCarEntity(mockCarProperties(), mock3DObject(), mockRaycastVehicle());
      car.acceleration = 1;
      car.gear = 3;
      car.applyRemoteInput(null);
      expect(car.acceleration).toBe(0);
      expect(car.brake).toBe(1);
      expect(car.gear).toBe(0);
    });

    it(`captures chassis state plus driving state, and adopts it on a replica`, () => {
      const owner = new GgCarEntity(mockCarProperties(), mock3DObject(), mockRaycastVehicle());
      owner.raycastVehicle.vehicleComponent.position = { x: 10, y: 0, z: 0 };
      owner.gear = 2;
      owner.acceleration = 0.5;
      (owner.raycastVehicle.vehicleComponent as any).isSleeping = false;
      const state = owner.captureNetworkState();
      expect(state).toEqual(expect.objectContaining({ p: { x: 10, y: 0, z: 0 }, gear: 2, accel: 0.5 }));

      const vehicle = mockRaycastVehicle();
      Object.assign(vehicle, { wakeUp: () => {}, sleep: () => {}, isSleeping: false });
      const resetSpy = jest.spyOn(vehicle, 'resetSuspension');
      const replica = new GgCarEntity(mockCarProperties(), mock3DObject(), vehicle);
      const ctx = { ageMs: 0, dt: 16, snap: false, tuning: { ...DEFAULT_CORRECTION_TUNING } };
      expect(replica.applyNetworkState(state, ctx)).toBe('snap');
      expect(replica.raycastVehicle.vehicleComponent.position).toEqual({ x: 10, y: 0, z: 0 }); // 10m away: snapped
      expect(resetSpy).toHaveBeenCalled();
      expect(replica.gear).toBe(2);
      expect(replica.acceleration).toBe(0.5);
    });

    it(`carries a gear change in progress, adopted by age rather than restarted on the replica`, () => {
      const props = () => ({
        ...mockCarProperties(),
        transmission: { ...mockCarProperties().transmission, shiftTime: 400 },
      });
      const owner = new GgCarEntity(props(), mock3DObject(), mockRaycastVehicle());
      (owner.raycastVehicle.vehicleComponent as any).isSleeping = false;
      owner.gear = 2;
      expect(owner.captureNetworkState().shiftMs).toBe(400);

      const vehicle = mockRaycastVehicle();
      Object.assign(vehicle, { wakeUp: () => {}, sleep: () => {}, isSleeping: false });
      const replica = new GgCarEntity(props(), mock3DObject(), vehicle);
      const ctx = { ageMs: 150, dt: 16, snap: true, tuning: { ...DEFAULT_CORRECTION_TUNING } };
      replica.applyNetworkState(owner.captureNetworkState(), ctx);
      expect(replica.gear).toBe(2);
      expect(replica.shiftRemainingMs).toBe(250);
      // a snapshot taken after the owner's shift ended must not leave the replica shifting
      replica.applyNetworkState({ ...owner.captureNetworkState(), shiftMs: 0 }, ctx);
      expect(replica.isShifting).toBe(false);
    });

    it(`leaves the driving state to remote input while it drives the car`, () => {
      const replica = new GgCarEntity(mockCarProperties(), mock3DObject(), mockRaycastVehicle());
      replica.applyRemoteInput({ steeringFactor: 0.3, acceleration: 1, brake: 0, gear: 2, handBrake: false });
      const state = { ...replica.captureNetworkState(), gear: 4, steering: -1, accel: 0, brake: 1, handBrake: true };
      replica.applyNetworkState(state, { ageMs: 0, dt: 16, snap: false, tuning: { ...DEFAULT_CORRECTION_TUNING } });
      expect(replica.gear).toBe(2);
      expect(replica.steeringFactor).toBe(0.3);
      expect(replica.acceleration).toBe(1);
      expect(replica.handBrake).toBe(false);
      replica.applyRemoteInput(null);
      replica.applyNetworkState(state, { ageMs: 0, dt: 16, snap: false, tuning: { ...DEFAULT_CORRECTION_TUNING } });
      expect(replica.gear).toBe(4);
      expect(replica.handBrake).toBe(true);
    });
  });
});
