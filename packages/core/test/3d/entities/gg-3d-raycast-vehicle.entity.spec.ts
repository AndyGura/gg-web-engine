import { mockRaycastVehicleEntity } from '../../mocks/raycast-vehicle.mock';

describe(`Gg3dRaycastVehicleEntity`, () => {

  describe(`visible`, () => {
    it(`should hide wheels when car is hidden`, () => {
      const car = mockRaycastVehicleEntity();
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
