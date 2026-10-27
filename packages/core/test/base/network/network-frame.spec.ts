import {
  CharacterController3dEntity,
  DEFAULT_CORRECTION_TUNING,
  Frame3d,
  IRigidBodyComponent,
  MoverCorrection,
  NetworkApplyContext,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  quantizeNetAngularVelocity,
  quantizeNetPosition,
  quantizeNetRotation,
  quantizeNetVelocity,
  RigidBodyCorrection,
} from '../../../src';
import { mockCharacterController } from '../../mocks/character-controller.mock';

type PlainBody = IRigidBodyComponent<Point3, Point4> & {
  position: Point3;
  rotation: Point4;
  linearVelocity: Point3;
  angularVelocity: Point3;
};

const plainBody = (
  pose: Partial<Pick<PlainBody, 'position' | 'rotation' | 'linearVelocity' | 'angularVelocity'>> = {},
) =>
  ({
    position: Pnt3.O,
    rotation: Qtrn.O,
    linearVelocity: Pnt3.O,
    angularVelocity: Pnt3.O,
    isSleeping: false,
    bodyOptions: { bodyType: 'dynamic' },
    wakeUp() {},
    sleep() {},
    ...pose,
  }) as unknown as PlainBody;

const ctx = (overrides: Partial<NetworkApplyContext> = {}): NetworkApplyContext => ({
  ageMs: 0,
  dt: 16,
  snap: false,
  tuning: { ...DEFAULT_CORRECTION_TUNING },
  ...overrides,
});

/** angle between two orientations, whatever the (quantised) quaternions' lengths */
const angle = (qa: Point4, qb: Point4) => {
  const a = Qtrn.normalize(qa);
  const b = Qtrn.normalize(qb);
  return 2 * Math.acos(Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)));
};

const expectNear = (a: Point3, b: Point3, eps: number) => {
  expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(eps);
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(eps);
  expect(Math.abs(a.z - b.z)).toBeLessThanOrEqual(eps);
};

// two sections of one open world, ~100 km from the global origin and turned against each other
const FRAME_A = new Frame3d({ x: 100_000, y: -40_000, z: 12 }, 2.4);
const FRAME_B = new Frame3d({ x: 100_250, y: -39_900, z: 0 }, -Math.PI);

describe('network state through a world frame', () => {
  describe('quantisation', () => {
    it('rounds positions to 1 mm, velocities to 1 mm/s, rotations to 5 decimals', () => {
      const p = quantizeNetPosition({ x: 100_000.123_456_7, y: -99_999.999_6, z: 0.000_4 });
      expect(p).toEqual({ x: 100_000.123, y: -100_000, z: 0 });
      expect(JSON.stringify(p)).toBe('{"x":100000.123,"y":-100000,"z":0}');
      expect(quantizeNetVelocity({ x: 12.345_67, y: -0.000_49 })).toEqual({ x: 12.346, y: 0 });
      expect(quantizeNetAngularVelocity(1.234_56)).toBe(1.235);
      expect(quantizeNetRotation(0.123_456_789)).toBe(0.12346);
      const q = quantizeNetRotation(Qtrn.fromEuler({ x: 0.1, y: 0.2, z: 0.3 }));
      for (const c of [q.x, q.y, q.z, q.w]) {
        expect(Math.round(c * 1e5) / 1e5).toBe(c);
      }
    });

    it('stays within half a step of the input, at any magnitude', () => {
      for (let i = 0; i < 500; i++) {
        const v = { x: (Math.random() - 0.5) * 4e5, y: (Math.random() - 0.5) * 4e5, z: (Math.random() - 0.5) * 2e3 };
        expectNear(quantizeNetPosition(v), v, 0.0005 + 1e-9);
        expectNear(quantizeNetVelocity(v), v, 0.0005 + 1e-9);
        const q = Qtrn.normalize({
          x: Math.random() - 0.5,
          y: Math.random() - 0.5,
          z: Math.random() - 0.5,
          w: Math.random() - 0.5,
        });
        // 5 decimals per component: an orientation error of a few 1e-5 rad at most, once normalized
        expect(angle(Qtrn.normalize(quantizeNetRotation(q)), q)).toBeLessThan(3e-5);
      }
    });
  });

  describe('RigidBodyCorrection', () => {
    it('captures global, quantised state through the frame', () => {
      const body = plainBody({
        position: { x: 1, y: 2, z: 3 },
        rotation: Qtrn.fromAngle(Pnt3.Z, 0.5),
        linearVelocity: { x: 4, y: 0, z: -1 },
        angularVelocity: { x: 0, y: 1, z: 0.25 },
      });
      const s = RigidBodyCorrection.capture(body, FRAME_A);
      expectNear(s.p, FRAME_A.toGlobalPoint(body.position), 0.0005);
      expectNear(s.lv, FRAME_A.toGlobalDirection(body.linearVelocity), 0.0005);
      expectNear(s.av as Point3, FRAME_A.toGlobalDirection(body.angularVelocity), 0.0005);
      expect(angle(s.r, FRAME_A.toGlobalRotation(body.rotation))).toBeLessThan(3e-5);
      expect(s.p).toEqual(quantizeNetPosition(s.p));
      // without a frame the snapshot is in world coordinates
      expectNear(RigidBodyCorrection.capture(body).p, body.position, 0);
    });

    it('a replica in another frame lands at the same global pose', () => {
      const owner = plainBody({
        position: { x: -20.5, y: 7.25, z: 1 },
        rotation: Qtrn.fromEuler({ x: 0.3, y: -0.2, z: 1.7 }),
        linearVelocity: { x: 3, y: -2, z: 0.5 },
        angularVelocity: { x: 0.1, y: 0, z: 2 },
      });
      const wire = JSON.parse(JSON.stringify(RigidBodyCorrection.capture(owner, FRAME_A)));
      const replica = plainBody();
      expect(RigidBodyCorrection.correct(replica, wire, ctx({ snap: true }), undefined, FRAME_B)).toBe('snap');
      expectNear(FRAME_B.toGlobalPoint(replica.position), FRAME_A.toGlobalPoint(owner.position), 0.001);
      expect(angle(FRAME_B.toGlobalRotation(replica.rotation), FRAME_A.toGlobalRotation(owner.rotation))).toBeLessThan(
        3e-5,
      );
      expectNear(
        FRAME_B.toGlobalDirection(replica.linearVelocity),
        FRAME_A.toGlobalDirection(owner.linearVelocity),
        0.001,
      );
      expectNear(
        FRAME_B.toGlobalDirection(replica.angularVelocity),
        FRAME_A.toGlobalDirection(owner.angularVelocity),
        0.001,
      );
      // a quantised quaternion is normalized before it is written
      expect(Math.hypot(replica.rotation.x, replica.rotation.y, replica.rotation.z, replica.rotation.w)).toBeCloseTo(
        1,
        12,
      );
    });

    it('converts at apply time: a replica already at the global pose stays put', () => {
      const owner = plainBody({ position: { x: 5, y: 5, z: 1 } });
      const wire = RigidBodyCorrection.capture(owner, FRAME_A);
      const replica = plainBody({
        position: FRAME_B.toLocalPoint(FRAME_A.toGlobalPoint(owner.position)),
        rotation: FRAME_B.toLocalRotation(FRAME_A.toGlobalRotation(owner.rotation)),
      });
      expect(RigidBodyCorrection.correct(replica, wire, ctx(), undefined, FRAME_B)).toBe('none');
    });

    it('toGlobal/toLocal round trip and keep extra fields', () => {
      const s = { p: { x: 1, y: 2, z: 3 }, r: Qtrn.fromAngle(Pnt3.X, 1), lv: Pnt3.Y, av: Pnt3.Z, s: false, gear: 3 };
      const back = RigidBodyCorrection.toLocal(RigidBodyCorrection.toGlobal(s, FRAME_A), FRAME_A);
      expect(back.gear).toBe(3);
      expectNear(back.p, s.p, 1e-9);
      expectNear(back.lv, s.lv, 1e-12);
      expect(angle(back.r, s.r)).toBeLessThan(1e-7);
    });
  });

  describe('MoverCorrection', () => {
    it('a replica character in another frame lands at the same global pose and momentum', () => {
      const owner = new CharacterController3dEntity(
        { radius: 0.4, centersDistance: 1 },
        null,
        mockCharacterController(),
      );
      owner.onSpawned({} as any);
      owner.position = { x: 12, y: -3, z: 1 };
      owner.rotation = Qtrn.fromAngle(Pnt3.Z, 0.8);
      owner.fallVelocity = { x: 0, y: 0, z: -4 };
      owner.airHorizontalVelocity = { x: 2, y: 1, z: 0 };
      const wire = JSON.parse(JSON.stringify(MoverCorrection.capture(owner, FRAME_A)));

      const replica = new CharacterController3dEntity(
        { radius: 0.4, centersDistance: 1 },
        null,
        mockCharacterController(),
      );
      replica.onSpawned({} as any);
      expect(MoverCorrection.correct(replica, wire, ctx({ snap: true }), undefined, FRAME_B)).toBe('snap');
      expectNear(FRAME_B.toGlobalPoint(replica.position), FRAME_A.toGlobalPoint(owner.position), 0.001);
      expect(angle(FRAME_B.toGlobalRotation(replica.rotation), FRAME_A.toGlobalRotation(owner.rotation))).toBeLessThan(
        3e-5,
      );
      expectNear(
        FRAME_B.toGlobalDirection(replica.airHorizontalVelocity),
        FRAME_A.toGlobalDirection(owner.airHorizontalVelocity),
        0.001,
      );
      expectNear(replica.fallVelocity, owner.fallVelocity, 0.001);
    });

    it("a character's input rotation is global on the wire", () => {
      const owner = new CharacterController3dEntity(
        { radius: 0.4, centersDistance: 1 },
        null,
        mockCharacterController(),
      );
      owner.onSpawned({} as any);
      (owner as any)._world = { frame: FRAME_A };
      owner.rotation = Qtrn.fromAngle(Pnt3.Z, -1.1);
      owner.moveDirection = Pnt3.Y;
      const input = JSON.parse(JSON.stringify(owner.captureLocalInput()));
      expect(angle(input.rotation, FRAME_A.toGlobalRotation(owner.rotation))).toBeLessThan(3e-5);
      expect(input.moveDirection).toEqual(Pnt3.Y); // relative to the character: no conversion

      const replica = new CharacterController3dEntity(
        { radius: 0.4, centersDistance: 1 },
        null,
        mockCharacterController(),
      );
      replica.onSpawned({} as any);
      (replica as any)._world = { frame: FRAME_B };
      replica.applyRemoteInput(input);
      expect(angle(FRAME_B.toGlobalRotation(replica.rotation), FRAME_A.toGlobalRotation(owner.rotation))).toBeLessThan(
        3e-5,
      );
      (owner as any)._world = null;
      (replica as any)._world = null;
    });
  });
});
