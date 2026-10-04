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
