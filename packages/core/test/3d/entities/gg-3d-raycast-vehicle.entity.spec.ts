import { mockCarProperties, mockRaycastVehicle } from '../../mocks/raycast-vehicle.mock';
import { RaycastVehicle3dEntity } from '../../../src';
import { mock3DObject } from '../../mocks/object.mock';

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

});
