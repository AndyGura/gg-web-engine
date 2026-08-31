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
});
