import { TiltInput } from '../src';

describe('TiltInput', () => {
  const orient = (beta: number, gamma: number) => {
    const event = new Event('deviceorientation');
    Object.assign(event, { beta, gamma });
    window.dispatchEvent(event);
  };
  const setScreenAngle = (angle: number) =>
    Object.defineProperty(window.screen, 'orientation', { value: { angle }, configurable: true });

  beforeEach(() => {
    (window as any).DeviceOrientationEvent = class extends Event {};
    setScreenAngle(0);
  });

  afterEach(() => {
    delete (window as any).DeviceOrientationEvent;
  });

  it('reads a sideways tilt in portrait, upright or flat, with a deadzone and a limit', () => {
    const tilt = new TiltInput({ maxAngle: 30, deadzone: 0 });
    tilt.start();
    // flat on a table, right edge lowered by 15 degrees
    orient(0, 15);
    expect(tilt.value).toBeCloseTo(0.5);
    // held upright and rolled 15 degrees to the left like a steering wheel
    orient(75, -89.999);
    expect(tilt.value).toBeCloseTo(-0.5);
    orient(45, 0);
    expect(tilt.value).toBeCloseTo(0);
    tilt.stop();
    expect(tilt.value).toBe(0);
  });

  it('follows the screen rotation', () => {
    const tilt = new TiltInput({ maxAngle: 30, deadzone: 0 });
    tilt.start();
    // rotated counter-clockwise: the device's bottom edge is the right edge of the screen, and
    // lowering it tips the device's top edge up
    setScreenAngle(90);
    orient(15, 0);
    expect(tilt.value).toBeCloseTo(0.5);
    setScreenAngle(270);
    orient(15, 0);
    expect(tilt.value).toBeCloseTo(-0.5);
    tilt.stop();
  });

  it('applies the deadzone and the invert option', () => {
    const tilt = new TiltInput({ maxAngle: 32, deadzone: 2, invert: true });
    tilt.start();
    orient(0, 1.5);
    expect(tilt.value).toBe(0);
    orient(0, 17);
    expect(tilt.value).toBeCloseTo(-0.5);
    tilt.stop();
  });

  it('reports denied on a page that is not a secure context', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    const tilt = new TiltInput({ deadzone: 0 });
    const states: string[] = [];
    tilt.permission$.subscribe(s => states.push(s));
    tilt.start();
    orient(0, 15);
    expect(tilt.value).toBe(0);
    expect(states).toEqual(['unknown', 'denied']);
    expect(warn).toHaveBeenCalledTimes(1);
    tilt.stop();
    delete (window as any).isSecureContext;
    warn.mockRestore();
  });

  it('asks for the permission on the next tap where one is needed', async () => {
    const requestPermission = jest.fn().mockResolvedValue('granted');
    (window as any).DeviceOrientationEvent.requestPermission = requestPermission;
    const tilt = new TiltInput({ deadzone: 0 });
    const states: string[] = [];
    tilt.permission$.subscribe(s => states.push(s));
    tilt.start();
    orient(0, 15);
    expect(tilt.value).toBe(0);

    window.dispatchEvent(new Event('click'));
    await Promise.resolve();
    await Promise.resolve();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(states).toEqual(['unknown', 'granted']);
    orient(0, 15);
    expect(tilt.value).toBeCloseTo(0.5);
    tilt.stop();
  });
});
