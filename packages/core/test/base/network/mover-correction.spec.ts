import {
  CharacterController2dEntity,
  CharacterController3dEntity,
  DEFAULT_CORRECTION_TUNING,
  isNetworkInputDriven,
  isNetworkSyncable,
  MoverCorrection,
  MoverNetState,
  NetworkApplyContext,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
} from '../../../src';
import { mockCharacterController } from '../../mocks/character-controller.mock';
import { mockCharacterController2d } from '../../mocks/character-controller-2d.mock';

const ctx = (overrides: Partial<NetworkApplyContext> = {}): NetworkApplyContext => ({
  ageMs: 0,
  dt: 16,
  snap: false,
  tuning: { ...DEFAULT_CORRECTION_TUNING },
  ...overrides,
});

const target3d = (overrides: Partial<MoverNetState<Point3, Point4>> = {}): MoverNetState<Point3, Point4> => ({
  p: { x: 0, y: 0, z: 0 },
  r: { x: 0, y: 0, z: 0, w: 1 },
  fv: { x: 0, y: 0, z: 0 },
  ahv: { x: 0, y: 0, z: 0 },
  crouch: false,
  v: { x: 0, y: 0, z: 0 },
  ...overrides,
});

const spawned3d = () => {
  const cc = mockCharacterController();
  const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, null, cc);
  entity.onSpawned({} as any);
  return { entity, cc };
};

describe('MoverCorrection', () => {
  it('turns position error into externalDisplacement instead of teleporting', () => {
    const { entity } = spawned3d();
    const outcome = MoverCorrection.correct(entity, target3d({ p: { x: 1, y: 0, z: 0 } }), ctx());
    expect(outcome).toBe('blend');
    expect(entity.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(entity.externalDisplacement.x).toBeCloseTo(1 * 6 * 0.016);
  });

  it('extrapolates by the owner-reported actual velocity', () => {
    const { entity } = spawned3d();
    MoverCorrection.correct(entity, target3d({ v: { x: 4, y: 0, z: 0 } }), ctx({ ageMs: 100, snap: true }));
    expect(entity.position.x).toBeCloseTo(0.4);
  });

  it('snaps above snapDistance and adopts the owner momentum', () => {
    const { entity } = spawned3d();
    const outcome = MoverCorrection.correct(
      entity,
      target3d({ p: { x: 5, y: 0, z: 0 }, fv: { x: 0, y: 0, z: 3 }, ahv: { x: 1, y: 0, z: 0 } }),
      ctx(),
    );
    expect(outcome).toBe('snap');
    expect(entity.position).toEqual({ x: 5, y: 0, z: 0 });
    expect(entity.fallVelocity).toEqual({ x: 0, y: 0, z: 3 });
    expect(entity.airHorizontalVelocity).toEqual({ x: 1, y: 0, z: 0 });
  });

  it('does nothing inside the deadzone', () => {
    const { entity } = spawned3d();
    expect(MoverCorrection.correct(entity, target3d({ p: { x: 0.01, y: 0, z: 0 } }), ctx())).toBe('none');
    expect(entity.externalDisplacement).toEqual(Pnt3.O);
  });

  it('lerps rotation toward the target', () => {
    const { entity } = spawned3d();
    MoverCorrection.correct(entity, target3d({ r: Qtrn.fromAngle(Pnt3.Z, Math.PI / 2) }), ctx());
    expect(entity.rotation.z).toBeGreaterThan(0);
    expect(entity.rotation.z).toBeLessThan(Math.sin(Math.PI / 4));
  });

  it('works on a 2D character', () => {
    const cc = mockCharacterController2d();
    const entity = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, null, cc);
    entity.onSpawned({} as any);
    MoverCorrection.correct(
      entity,
      { p: { x: 1, y: 0 }, r: 0, fv: { x: 0, y: 0 }, ahv: { x: 0, y: 0 }, crouch: false },
      ctx(),
    );
    expect(entity.externalDisplacement.x).toBeGreaterThan(0);
  });
});

describe('CharacterController3dEntity network contracts', () => {
  it('implements INetworkSyncable and INetworkInputDriven', () => {
    const { entity } = spawned3d();
    expect(isNetworkSyncable(entity)).toBe(true);
    expect(isNetworkInputDriven(entity)).toBe(true);
  });

  it('folds externalDisplacement into the next move() and clears it', () => {
    const { entity, cc } = spawned3d();
    const moveSpy = jest.spyOn(cc, 'move');
    entity.externalDisplacement = { x: 0.5, y: 0, z: 0 };
    entity.tick$.next([16, 16]);
    expect(moveSpy.mock.calls[0][0].x).toBeCloseTo(0.5);
    expect(entity.externalDisplacement).toEqual(Pnt3.O);
    entity.tick$.next([32, 16]);
    expect(moveSpy.mock.calls[1][0].x).toBeCloseTo(0);
  });

  it('reports actualVelocity from the last tick displacement', () => {
    const { entity } = spawned3d();
    entity.moveDirection = { x: 0, y: 1, z: 0 };
    entity.tick$.next([1000, 1000]);
    expect(entity.actualVelocity.y).toBeCloseTo(4);
  });

  it('counts only jumps that actually happened', () => {
    const { entity, cc } = spawned3d();
    entity.jump();
    expect(entity.jumpCount).toBe(1);
    (cc as any).isGrounded = false;
    entity.jump();
    expect(entity.jumpCount).toBe(1);
  });

  it('captures and applies input, firing a remote jump once per jumpSeq increment', () => {
    const { entity: owner } = spawned3d();
    const { entity: replica } = spawned3d();
    owner.moveDirection = { x: 1, y: 0, z: 0 };
    owner.isRunning = true;
    replica.applyRemoteInput(owner.captureLocalInput()); // baseline, no jump
    expect(replica.jumpCount).toBe(0);
    expect(replica.moveDirection).toEqual({ x: 1, y: 0, z: 0 });
    expect(replica.isRunning).toBe(true);

    owner.jump();
    const sample = owner.captureLocalInput();
    replica.applyRemoteInput(sample);
    replica.applyRemoteInput(sample); // duplicate/reordered sample: no second jump
    expect(replica.jumpCount).toBe(1);
  });

  it('applies neutral input on null', () => {
    const { entity } = spawned3d();
    entity.moveDirection = { x: 1, y: 0, z: 0 };
    entity.isRunning = true;
    entity.applyRemoteInput(null);
    expect(entity.moveDirection).toEqual(Pnt3.O);
    expect(entity.isRunning).toBe(false);
  });

  it('remembers a crouch set before spawning and rebuilds the capsule on spawn', () => {
    const cc = mockCharacterController();
    const created: any[] = [];
    const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, null, cc);
    entity.isCrouching = true;
    expect(entity.isCrouching).toBe(true);
    const world: any = {
      physicsWorld: {
        factory: {
          createCharacterController: (opts: any, transform: any) => {
            const c = mockCharacterController(opts.radius, opts.centersDistance);
            c.position = transform.position;
            created.push(c);
            return c;
          },
        },
      },
    };
    entity.onSpawned(world);
    expect(created).toHaveLength(1);
    expect(entity.characterController.centersDistance).toBeCloseTo(0.6);
  });
});

describe('CharacterController2dEntity network contracts', () => {
  it('captures and applies 2D input', () => {
    const owner = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, null, mockCharacterController2d());
    const replica = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, null, mockCharacterController2d());
    owner.onSpawned({} as any);
    replica.onSpawned({} as any);
    owner.moveDirection = -1;
    replica.applyRemoteInput(owner.captureLocalInput());
    owner.jump();
    replica.applyRemoteInput(owner.captureLocalInput());
    expect(replica.moveDirection).toBe(-1);
    expect(replica.jumpCount).toBe(1);
  });

  it('folds externalDisplacement into move()', () => {
    const cc = mockCharacterController2d();
    const entity = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, null, cc);
    entity.onSpawned({} as any);
    const moveSpy = jest.spyOn(cc, 'move');
    entity.externalDisplacement = { x: 0, y: 0.25 };
    entity.tick$.next([16, 16]);
    expect(moveSpy.mock.calls[0][0].y).toBeCloseTo(0.25);
  });
});
