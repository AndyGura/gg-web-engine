import { AudioListenerBasis, IPositionable, Pnt3, Point3, Point4, Qtrn } from '@gg-web-engine/core';
import { WebAudioScene3dComponent } from '../../src/components/web-audio-scene-3d.component';

/**
 * An `AudioParam` that follows its automation the way the browser renders it: `setTargetAtTime`
 * approaches the target exponentially from wherever the param is at that time, `setValueAtTime`
 * jumps. `valueAt(t)` is what the audio thread would hear at context time `t`.
 */
class FakeParam {
  /** where the last ramp (or jump) is heading */
  public target: number;
  private startValue: number;
  private startTime = 0;
  private tau = 0;

  constructor(public value: number) {
    this.target = value;
    this.startValue = value;
  }

  valueAt(time: number): number {
    if (this.tau <= 0) {
      // a jump: startValue is the target
      return this.target;
    }
    if (time <= this.startTime) {
      return this.startValue;
    }
    return this.target + (this.startValue - this.target) * Math.exp(-(time - this.startTime) / this.tau);
  }

  setTargetAtTime = jest.fn((value: number, time: number, tau: number) => {
    this.startValue = this.valueAt(time);
    this.startTime = time;
    this.tau = tau;
    this.target = value;
  });
  setValueAtTime = jest.fn((value: number, time: number) => {
    this.value = value;
    this.startValue = value;
    this.startTime = time;
    this.tau = 0;
    this.target = value;
  });
  cancelScheduledValues = jest.fn();
}

class FakeGainNode {
  public gain = new FakeParam(1);
  connect = jest.fn();
  disconnect = jest.fn();
}

/** the AudioParam-based `AudioListener` Chromium and current Safari have */
class FakeParamListener {
  public positionX = new FakeParam(0);
  public positionY = new FakeParam(0);
  public positionZ = new FakeParam(0);
  public forwardX = new FakeParam(0);
  public forwardY = new FakeParam(0);
  public forwardZ = new FakeParam(-1);
  public upX = new FakeParam(0);
  public upY = new FakeParam(1);
  public upZ = new FakeParam(0);
}

/** Firefox and older Safari: only the legacy methods */
class FakeLegacyListener {
  setPosition = jest.fn();
  setOrientation = jest.fn();
}

class FakeAudioContext {
  public state = 'running';
  public currentTime = 0;
  public destination = {};
  public onstatechange: (() => void) | null = null;
  public listener: FakeParamListener | FakeLegacyListener = new FakeParamListener();
  createGain = jest.fn(() => new FakeGainNode());
  resume = jest.fn(() => Promise.resolve());
  suspend = jest.fn(() => Promise.resolve());
  close = jest.fn(() => Promise.resolve());
}

/** one tick of a 60 fps world, in seconds */
const TICK = 1 / 60;

describe('listener orientation (WebAudioScene3dComponent)', () => {
  let originalAudioContext: unknown;
  let scene: WebAudioScene3dComponent;
  let context: FakeAudioContext;

  function positionable(rotation: Point4, position: Point3 = Pnt3.O): IPositionable<Point3, Point4> {
    return { position, rotation } as unknown as IPositionable<Point3, Point4>;
  }

  function listen(rotation: Point4, position: Point3 = Pnt3.O, basis?: AudioListenerBasis): void {
    scene.setActiveListener(positionable(rotation, position), basis);
    scene.update(0, 16);
  }

  function paramListener(): FakeParamListener {
    return context.listener as FakeParamListener;
  }

  /** the forward and up vectors the scene last sent to the native listener */
  function nativeOrientation(): { forward: Point3; up: Point3 } {
    const l = paramListener();
    return {
      forward: { x: l.forwardX.target, y: l.forwardY.target, z: l.forwardZ.target },
      up: { x: l.upX.target, y: l.upY.target, z: l.upZ.target },
    };
  }

  /** the forward and up vectors the audio thread renders at context time `time` */
  function heardOrientation(time: number): { forward: Point3; up: Point3 } {
    const l = paramListener();
    return {
      forward: { x: l.forwardX.valueAt(time), y: l.forwardY.valueAt(time), z: l.forwardZ.valueAt(time) },
      up: { x: l.upX.valueAt(time), y: l.upY.valueAt(time), z: l.upZ.valueAt(time) },
    };
  }

  function expectPoint(actual: Point3, expected: Point3): void {
    expect(actual.x).toBeCloseTo(expected.x);
    expect(actual.y).toBeCloseTo(expected.y);
    expect(actual.z).toBeCloseTo(expected.z);
  }

  beforeEach(() => {
    originalAudioContext = (global as any).AudioContext;
    (global as any).AudioContext = FakeAudioContext;
    scene = new WebAudioScene3dComponent();
    context = scene.context as unknown as FakeAudioContext;
  });

  afterEach(() => {
    scene.dispose();
    (global as any).AudioContext = originalAudioContext;
  });

  describe('basis', () => {
    it("reads 'camera' as local -Z forward, local +Y up", () => {
      listen(Qtrn.O, { x: 1, y: 2, z: 3 }, 'camera');
      const { forward, up } = nativeOrientation();
      expectPoint(forward, Pnt3.nZ);
      expectPoint(up, Pnt3.Y);
      const l = paramListener();
      expect([l.positionX.target, l.positionY.target, l.positionZ.target]).toEqual([1, 2, 3]);
    });

    it("reads 'body' as local +Y forward, local +Z up, so an upright entity faces level", () => {
      listen(Qtrn.fromAngle(Pnt3.Z, Math.PI / 2), Pnt3.O, 'body');
      const { forward, up } = nativeOrientation();
      expectPoint(forward, Pnt3.nX);
      expectPoint(up, Pnt3.Z);
      expect(scene.activeListenerBasis).toBe('body');
    });

    it("defaults to 'body' for a positionable that is not a camera", () => {
      listen(Qtrn.O);
      expect(scene.activeListenerBasis).toBe('body');
      expectPoint(nativeOrientation().forward, Pnt3.Y);
    });

    it("defaults to 'camera' for a camera component (anything with a fov)", () => {
      scene.setActiveListener({ position: Pnt3.O, rotation: Qtrn.O, fov: 60 } as unknown as IPositionable<
        Point3,
        Point4
      >);
      expect(scene.activeListenerBasis).toBe('camera');
    });

    it('follows a camera aimed with Qtrn.lookAt in the Z-up world: forward to the target, world +Z up', () => {
      // a camera looking level along world +X
      listen(Qtrn.lookAt(Pnt3.O, Pnt3.X), Pnt3.O, 'camera');
      const { forward, up } = nativeOrientation();
      expectPoint(forward, Pnt3.X);
      expectPoint(up, Pnt3.Z);
    });
  });

  describe('easing', () => {
    it('never renders a degenerate orientation while easing through turns, snap turns and listener switches', () => {
      const body = positionable(Qtrn.O);
      const camera = positionable(Qtrn.lookAt(Pnt3.O, Pnt3.nY));
      scene.setActiveListener(body, 'body');
      // per tick: which listener, and its rotation
      const timeline: [IPositionable<Point3, Point4>, Point4][] = [];
      // a steady turn at 720 deg/s
      for (let i = 0; i < 30; i++) {
        timeline.push([body, Qtrn.fromAngle(Pnt3.Z, (i * 12 * Math.PI) / 180)]);
      }
      // a 180 deg snap turn
      timeline.push([body, Qtrn.fromAngle(Pnt3.Z, (29 * 12 * Math.PI) / 180 + Math.PI)]);
      timeline.push([body, Qtrn.fromAngle(Pnt3.Z, (29 * 12 * Math.PI) / 180 + Math.PI)]);
      // switch to a camera facing the opposite way, then back
      timeline.push([camera, camera.rotation], [camera, camera.rotation], [body, Qtrn.O], [body, Qtrn.O]);
      // a flip upside down
      timeline.push([body, Qtrn.fromAngle(Pnt3.Y, Math.PI)], [body, Qtrn.fromAngle(Pnt3.Y, Math.PI)]);

      for (const [listener, rotation] of timeline) {
        if (scene.activeListener !== listener) {
          scene.setActiveListener(listener);
        }
        (listener as { rotation: Point4 }).rotation = rotation;
        scene.update(0, TICK * 1000);
        for (let step = 0; step < 8; step++) {
          const { forward, up } = heardOrientation(context.currentTime + (step * TICK) / 8);
          expect(Pnt3.len(forward)).toBeGreaterThan(0.6);
          expect(Pnt3.len(up)).toBeGreaterThan(0.6);
          // has a left/right axis
          expect(Pnt3.len(Pnt3.cross(Pnt3.norm(forward), Pnt3.norm(up)))).toBeGreaterThan(0.6);
        }
        context.currentTime += TICK;
      }
    });

    it('ramps a small turn and a move', () => {
      const listener = positionable(Qtrn.O);
      scene.setActiveListener(listener);
      scene.update(0, 16);
      const l = paramListener();
      l.forwardX.setValueAtTime.mockClear();
      l.positionX.setValueAtTime.mockClear();
      context.currentTime += TICK;
      Object.assign(listener, { rotation: Qtrn.fromAngle(Pnt3.Z, 0.2), position: { x: 1, y: 0, z: 0 } });
      scene.update(0, 16);
      expect(l.forwardX.setTargetAtTime).toHaveBeenCalled();
      expect(l.forwardX.setValueAtTime).not.toHaveBeenCalled();
      expect(l.positionX.setTargetAtTime).toHaveBeenLastCalledWith(1, context.currentTime, expect.any(Number));
      expect(l.positionX.setValueAtTime).not.toHaveBeenCalled();
    });

    it('jumps the orientation, not the position, on a turn of more than 90 degrees', () => {
      const listener = positionable(Qtrn.O);
      scene.setActiveListener(listener);
      scene.update(0, 16);
      const l = paramListener();
      l.forwardX.setValueAtTime.mockClear();
      l.positionX.setValueAtTime.mockClear();
      context.currentTime += TICK;
      Object.assign(listener, { rotation: Qtrn.fromAngle(Pnt3.Z, Math.PI), position: { x: 1, y: 0, z: 0 } });
      scene.update(0, 16);
      expect(l.forwardY.setValueAtTime).toHaveBeenLastCalledWith(expect.closeTo(-1), context.currentTime);
      expect(l.positionX.setValueAtTime).not.toHaveBeenCalled();
    });

    it('jumps position and orientation to a newly set listener', () => {
      listen(Qtrn.O, { x: 5, y: 0, z: 0 });
      const l = paramListener();
      expect(l.positionX.setValueAtTime).toHaveBeenLastCalledWith(5, 0);
      context.currentTime += TICK;
      listen(Qtrn.fromAngle(Pnt3.Z, 0.1), { x: -5, y: 0, z: 0 });
      expect(l.positionX.setValueAtTime).toHaveBeenLastCalledWith(-5, context.currentTime);
      expect(l.forwardX.setValueAtTime).toHaveBeenCalledTimes(2);
    });
  });

  describe('legacy listener (no AudioParams)', () => {
    let legacy: FakeLegacyListener;

    beforeEach(() => {
      legacy = new FakeLegacyListener();
      context.listener = legacy;
    });

    function lastOrientation(): { forward: Point3; up: Point3 } {
      const [fx, fy, fz, ux, uy, uz] = legacy.setOrientation.mock.calls[legacy.setOrientation.mock.calls.length - 1];
      return { forward: { x: fx, y: fy, z: fz }, up: { x: ux, y: uy, z: uz } };
    }

    it('starts at the new listener at once', () => {
      listen(Qtrn.O, { x: 1, y: 2, z: 3 }, 'camera');
      expect(legacy.setPosition).toHaveBeenCalledWith(1, 2, 3);
      const { forward, up } = lastOrientation();
      expectPoint(forward, Pnt3.nZ);
      expectPoint(up, Pnt3.Y);
    });

    it('eases a move and a small turn in tick by tick, the way setTargetAtTime would', () => {
      const listener = positionable(Qtrn.O);
      scene.setActiveListener(listener);
      scene.update(0, 16);
      Object.assign(listener, { rotation: Qtrn.fromAngle(Pnt3.Z, 0.5), position: { x: 10, y: 0, z: 0 } });
      let previousX = 0;
      for (let i = 0; i < 4; i++) {
        context.currentTime += TICK;
        scene.update(0, 16);
        const x = legacy.setPosition.mock.calls[legacy.setPosition.mock.calls.length - 1][0];
        expect(x).toBeGreaterThanOrEqual(previousX);
        expect(x).toBeLessThan(10);
        previousX = x;
      }
      expect(previousX).toBeGreaterThan(0);
      // not there yet, but on its way
      const { forward } = lastOrientation();
      expect(Pnt3.angle(forward, Pnt3.Y)).toBeGreaterThan(0);
      expect(Pnt3.angle(forward, Pnt3.Y)).toBeLessThan(0.5);
      // and arrives
      for (let i = 0; i < 60; i++) {
        context.currentTime += TICK;
        scene.update(0, 16);
      }
      expect(legacy.setPosition.mock.calls[legacy.setPosition.mock.calls.length - 1][0]).toBeCloseTo(10);
      expectPoint(lastOrientation().forward, Pnt3.rot(Pnt3.Y, Qtrn.fromAngle(Pnt3.Z, 0.5)));
    });

    it('jumps a turn of more than 90 degrees', () => {
      const listener = positionable(Qtrn.O);
      scene.setActiveListener(listener);
      scene.update(0, 16);
      context.currentTime += TICK;
      Object.assign(listener, { rotation: Qtrn.fromAngle(Pnt3.Z, Math.PI) });
      scene.update(0, 16);
      expectPoint(lastOrientation().forward, Pnt3.nY);
    });
  });
});
