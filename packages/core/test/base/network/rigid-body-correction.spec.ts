import {
  BodyType,
  CorrectionTuning,
  DEFAULT_CORRECTION_TUNING,
  IRigidBodyComponent,
  NetworkApplyContext,
  Pnt3,
  Point2,
  Point3,
  Point4,
  Qtrn,
  RigidBodyCorrection,
  RigidBodyNetState,
} from '../../../src';

type MockBody<D, R> = IRigidBodyComponent<D, R> & { sleeping: boolean; writes: string[] };

function mockBody3d(bodyType: BodyType = 'dynamic'): MockBody<Point3, Point4> {
  const body: any = {
    writes: [] as string[],
    sleeping: false,
    _p: { x: 0, y: 0, z: 0 },
    _r: { x: 0, y: 0, z: 0, w: 1 },
    _lv: { x: 0, y: 0, z: 0 },
    _av: { x: 0, y: 0, z: 0 },
    get position() {
      return this._p;
    },
    set position(v) {
      this.writes.push('position');
      this._p = v;
    },
    get rotation() {
      return this._r;
    },
    set rotation(v) {
      this.writes.push('rotation');
      this._r = v;
    },
    get linearVelocity() {
      return this._lv;
    },
    set linearVelocity(v) {
      this.writes.push('linearVelocity');
      this._lv = v;
    },
    get angularVelocity() {
      return this._av;
    },
    set angularVelocity(v) {
      this.writes.push('angularVelocity');
      this._av = v;
    },
    get isSleeping() {
      return this.sleeping;
    },
    wakeUp() {
      this.writes.push('wakeUp');
      this.sleeping = false;
    },
    sleep() {
      this.writes.push('sleep');
      this.sleeping = true;
    },
    bodyOptions: { bodyType },
  };
  return body;
}

function mockBody2d(bodyType: BodyType = 'dynamic'): MockBody<Point2, number> {
  const body = mockBody3d(bodyType) as any;
  body._p = { x: 0, y: 0 };
  body._r = 0;
  body._lv = { x: 0, y: 0 };
  body._av = 0;
  return body;
}

const ctx = (overrides: Partial<NetworkApplyContext> = {}): NetworkApplyContext => ({
  ageMs: 0,
  dt: 16,
  snap: false,
  tuning: { ...DEFAULT_CORRECTION_TUNING },
  ...overrides,
});

const state3d = (overrides: Partial<RigidBodyNetState<Point3, Point4>> = {}): RigidBodyNetState<Point3, Point4> => ({
  p: { x: 0, y: 0, z: 0 },
  r: { x: 0, y: 0, z: 0, w: 1 },
  lv: { x: 0, y: 0, z: 0 },
  av: { x: 0, y: 0, z: 0 },
  s: false,
  ...overrides,
});

describe('RigidBodyCorrection', () => {
  describe('capture', () => {
    it('produces a plain JSON snapshot of position, rotation, velocities and sleep flag', () => {
      const body = mockBody3d();
      body.position = { x: 1, y: 2, z: 3, extra: 'native' } as any;
      body.linearVelocity = { x: 4, y: 5, z: 6 };
      body.sleeping = true;
      const snapshot = RigidBodyCorrection.capture(body);
      expect(snapshot).toEqual({
        p: { x: 1, y: 2, z: 3 },
        r: { x: 0, y: 0, z: 0, w: 1 },
        lv: { x: 4, y: 5, z: 6 },
        av: { x: 0, y: 0, z: 0 },
        s: true,
      });
      expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    });
  });

  describe('dynamic body', () => {
    it('does nothing inside the deadzone', () => {
      const body = mockBody3d();
      body.writes.length = 0;
      const outcome = RigidBodyCorrection.correct(body, state3d({ p: { x: 0.01, y: 0, z: 0 } }), ctx());
      expect(outcome).toBe('none');
      expect(body.writes).toEqual([]);
    });

    it('puts an awake replica to sleep when the target sleeps and the error is inside the deadzone', () => {
      const body = mockBody3d();
      const outcome = RigidBodyCorrection.correct(body, state3d({ s: true }), ctx());
      expect(outcome).toBe('sleep');
      expect(body.isSleeping).toBe(true);
    });

    it('snaps above snapDistance, writing the extrapolated state', () => {
      const body = mockBody3d();
      const outcome = RigidBodyCorrection.correct(
        body,
        state3d({ p: { x: 10, y: 0, z: 0 }, lv: { x: 1, y: 0, z: 0 } }),
        ctx({ ageMs: 100 }),
      );
      expect(outcome).toBe('snap');
      expect(body.position.x).toBeCloseTo(10.1);
      expect(body.linearVelocity).toEqual({ x: 1, y: 0, z: 0 });
    });

    it('snaps on ctx.snap even for a tiny error', () => {
      const body = mockBody3d();
      const outcome = RigidBodyCorrection.correct(body, state3d({ p: { x: 0.001, y: 0, z: 0 } }), ctx({ snap: true }));
      expect(outcome).toBe('snap');
      expect(body.position.x).toBeCloseTo(0.001);
    });

    it('caps extrapolation at extrapolateMaxMs', () => {
      const body = mockBody3d();
      RigidBodyCorrection.correct(
        body,
        state3d({ p: { x: 0, y: 0, z: 0 }, lv: { x: 10, y: 0, z: 0 } }),
        ctx({ ageMs: 10_000, snap: true }),
      );
      expect(body.position.x).toBeCloseTo(2.5); // 10 m/s * 250 ms
    });

    it('blends through a velocity bias toward the target instead of teleporting', () => {
      const body = mockBody3d();
      const outcome = RigidBodyCorrection.correct(body, state3d({ p: { x: 1, y: 0, z: 0 } }), ctx());
      expect(outcome).toBe('blend');
      expect(body.writes).not.toContain('position');
      expect(body.linearVelocity.x).toBeGreaterThan(0);
    });

    it('converges onto a moving target over repeated ticks when integrated', () => {
      const body = mockBody3d();
      body.position = { x: -1, y: 0.5, z: 0 };
      let target = state3d({ p: { x: 0, y: 0, z: 0 }, lv: { x: 2, y: 0, z: 0 } });
      for (let i = 0; i < 240; i++) {
        RigidBodyCorrection.correct(body, target, ctx());
        // integrate both like a physics step would
        body.position = Pnt3.add(body.position, Pnt3.scalarMult(body.linearVelocity, 0.016));
        target = { ...target, p: Pnt3.add(target.p, Pnt3.scalarMult(target.lv, 0.016)) };
      }
      expect(Pnt3.dist(body.position, target.p)).toBeLessThan(0.05);
    });

    it('wakes a sleeping replica when the target is awake', () => {
      const body = mockBody3d();
      body.sleeping = true;
      RigidBodyCorrection.correct(body, state3d({ p: { x: 0.5, y: 0, z: 0 } }), ctx());
      expect(body.isSleeping).toBe(false);
    });

    it('extrapolates rotation from angular velocity', () => {
      const body = mockBody3d();
      RigidBodyCorrection.correct(
        body,
        state3d({ av: { x: 0, y: 0, z: Math.PI } }), // half a turn per second around Z
        ctx({ ageMs: 100, snap: true }),
      );
      const expected = Qtrn.fromAngle(Pnt3.Z, Math.PI / 10);
      expect(body.rotation.z).toBeCloseTo(expected.z);
      expect(body.rotation.w).toBeCloseTo(expected.w);
    });

    it('glides to a sleeping target without injecting velocity', () => {
      const body = mockBody3d();
      body.linearVelocity = { x: 3, y: 0, z: 0 };
      const outcome = RigidBodyCorrection.correct(body, state3d({ p: { x: 1, y: 0, z: 0 }, s: true }), ctx());
      expect(outcome).toBe('blend');
      expect(body.position.x).toBeGreaterThan(0);
      expect(body.position.x).toBeLessThan(1);
      expect(body.linearVelocity).toEqual({ x: 0, y: 0, z: 0 });
    });
  });

  describe('kinematic body', () => {
    it('lerps position and never writes velocity', () => {
      const body = mockBody3d('kinematic_pos');
      const outcome = RigidBodyCorrection.correct(body, state3d({ p: { x: 1, y: 0, z: 0 } }), ctx());
      expect(outcome).toBe('blend');
      expect(body.position.x).toBeGreaterThan(0);
      expect(body.position.x).toBeLessThan(1);
      expect(body.writes).not.toContain('linearVelocity');
    });

    it('snaps transform only', () => {
      const body = mockBody3d('kinematic_vel');
      RigidBodyCorrection.correct(body, state3d({ p: { x: 5, y: 0, z: 0 } }), ctx());
      expect(body.position.x).toBe(5);
      expect(body.writes).not.toContain('linearVelocity');
      expect(body.writes).not.toContain('sleep');
    });
  });

  it('never touches a static body', () => {
    const body = mockBody3d('static');
    expect(RigidBodyCorrection.correct(body, state3d({ p: { x: 5, y: 0, z: 0 } }), ctx())).toBe('none');
    expect(body.writes).toEqual([]);
  });

  describe('2D', () => {
    it('blends a scalar rotation and angular velocity', () => {
      const body = mockBody2d();
      const outcome = RigidBodyCorrection.correct(
        body,
        { p: { x: 0, y: 0 }, r: 1, lv: { x: 0, y: 0 }, av: 2, s: false },
        ctx(),
      );
      expect(outcome).toBe('blend');
      expect(body.rotation).toBeGreaterThan(0);
      expect(body.rotation).toBeLessThan(1);
      expect(body.angularVelocity).toBeGreaterThan(0);
    });

    it('wraps rotation error around ±π', () => {
      const body = mockBody2d();
      body.rotation = Math.PI - 0.001;
      body.writes.length = 0;
      // -π + 0.001 is 0.002 rad away, i.e. inside the 1° deadzone
      expect(
        RigidBodyCorrection.correct(
          body,
          { p: { x: 0, y: 0 }, r: -Math.PI + 0.001, lv: { x: 0, y: 0 }, av: 0, s: false },
          ctx(),
        ),
      ).toBe('none');
    });

    it('extrapolates position along linear velocity', () => {
      const body = mockBody2d();
      RigidBodyCorrection.correct(
        body,
        { p: { x: 0, y: 0 }, r: 0, lv: { x: 0, y: 10 }, av: 0, s: false },
        ctx({ ageMs: 100, snap: true }),
      );
      expect(body.position.y).toBeCloseTo(1);
    });
  });

  it('respects explicit tuning over ctx.tuning', () => {
    const body = mockBody3d();
    const tuning: CorrectionTuning = { ...DEFAULT_CORRECTION_TUNING, deadzone: 5, snapDistance: 10 };
    expect(RigidBodyCorrection.correct(body, state3d({ p: { x: 3, y: 0, z: 0 } }), ctx(), tuning)).toBe('none');
  });
});
