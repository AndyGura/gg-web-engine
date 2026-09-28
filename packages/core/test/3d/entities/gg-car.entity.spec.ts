import { mockCarProperties, mockRaycastVehicle } from '../../mocks/raycast-vehicle.mock';
import { GgCarEntity } from '../../../src';
import { mock3DObject } from '../../mocks/object.mock';

describe(`GgCarEntity`, () => {
  describe(`steeringFactor`, () => {
    it(`applies a plain-number maxSteerAngle unconditionally of speed`, () => {
      const car = new GgCarEntity({ ...mockCarProperties(), maxSteerAngle: 0.35 }, mock3DObject(), mockRaycastVehicle());

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
});
