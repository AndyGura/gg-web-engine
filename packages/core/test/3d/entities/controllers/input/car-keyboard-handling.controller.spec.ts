import { CarKeyboardHandlingController, KeyboardInput } from '../../../../../src';
import { mockRaycastVehicleEntity } from '../../../../mocks/raycast-vehicle.mock';

describe(`CarKeyboardHandlingController`, () => {
  describe(`emitting values`, () => {
    it(`should emit acceleration`, async () => {
      const keyboardInput = new KeyboardInput();
      await keyboardInput.start();
      const car = mockRaycastVehicleEntity();
      const controller = new CarKeyboardHandlingController(keyboardInput, car);
      await controller.onSpawned(null!);
      keyboardInput.emulateKeyDown('ArrowUp');
      const call = jest.spyOn(car, 'setYAxisControlValue');
      controller.tick$.next([0, 0]);
      expect(call).toHaveBeenCalledTimes(1);
      expect(call.mock.lastCall).toEqual([1]);
    });
    it(`should not emit steering after stopped`, async () => {
      const keyboardInput = new KeyboardInput();
      await keyboardInput.start();
      const car = mockRaycastVehicleEntity();
      const controller = new CarKeyboardHandlingController(keyboardInput, car);
      await controller.onSpawned(null!);
      keyboardInput.emulateKeyDown('ArrowLeft');
      controller.tick$.next([0, 0]);
      await controller.onRemoved();
      const call = jest.spyOn(car, 'setXAxisControlValue');
      await new Promise(r => setTimeout(r, 20)); // FIXME should be greater that TICKER_INTERVAL, rewrite when refactored
      expect(call).toHaveBeenCalledTimes(0);
    });
  });
});
