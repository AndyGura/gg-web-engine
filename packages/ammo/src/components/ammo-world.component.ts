import {
  BitMask,
  CollisionGroup,
  IPhysicsWorld3dComponent,
  Point3,
  RaycastOptions,
  RaycastResult,
} from '@gg-web-engine/core';
import { Subject } from 'rxjs';
import Ammo from '../ammo.js/ammo';
import { AmmoFactory } from '../ammo-factory';
import { AmmoLoader } from '../ammo-loader';
import { AmmoPhysicsTypeDocRepo } from '../types';
import { AmmoRigidBodyComponent } from './ammo-rigid-body.component';
import { AmmoTriggerComponent } from './ammo-trigger.component';
import { AmmoBodyComponent } from './ammo-body.component';

export class AmmoWorldComponent implements IPhysicsWorld3dComponent<AmmoPhysicsTypeDocRepo> {
  private _factory: AmmoFactory | null = null;
  public get factory(): AmmoFactory {
    if (!this._factory) {
      throw new Error('Ammo world not initialized');
    }
    return this._factory;
  }

  public readonly afterTick$: Subject<void> = new Subject<void>();
  public readonly added$: Subject<AmmoRigidBodyComponent | AmmoTriggerComponent> = new Subject();
  public readonly removed$: Subject<AmmoRigidBodyComponent | AmmoTriggerComponent> = new Subject();
  public readonly children: (AmmoRigidBodyComponent | AmmoTriggerComponent)[] = [];

  private _loader: AmmoLoader | null = null;
  public get loader(): AmmoLoader {
    if (!this._loader) {
      throw new Error('Ammo world not initialized');
    }
    return this._loader;
  }

  private _gravity: Point3 = { x: 0, y: 0, z: -9.82 };
  public get gravity(): Point3 {
    return this._gravity;
  }

  public set gravity(value: Point3) {
    this._gravity = value;
    if (this.gravityVector) {
      this.gravityVector.setValue(value.x, value.y, value.z);
      this._dynamicAmmoWorld?.setGravity(this.gravityVector);
    }
  }

  readonly mainCollisionGroup: CollisionGroup = 0;

  /**
   * Hard ceiling on how many substeps `simulate()` will ever run for one call, regardless of how
   * large `delta` is - protects against a single huge catch-up call (a dropped/backgrounded tab)
   * grinding substep-by-substep through an enormous amount of simulated time. Below this cap,
   * `simulate()` always runs however many substeps keep each one no longer than `fixedTimeStep` -
   * see that field's own doc for why a *dynamically computed* substep count/size, not Bullet's own
   * built-in accumulator, is what actually gets used. `0`/`undefined` (default `100`) means no cap
   * at all - the cap only ever trades simulation *accuracy* (larger-than-`fixedTimeStep` substeps)
   * for guaranteeing `delta` is always fully consumed in one call, never deferred.
   */
  public maxSubSteps?: number = 100;
  /**
   * The largest a single internal substep is allowed to be, in seconds - smaller keeps the solver
   * (suspension springs, fast/thin shapes, etc.) accurate and stable, at the cost of more substeps
   * per call. Default `0.01` (10ms).
   *
   * **Not passed straight through to `stepSimulation` as its own `fixedTimeStep` argument** - that
   * argument drives Bullet's built-in *accumulator* (`m_localTime`), which carries whatever doesn't
   * divide evenly into `fixedTimeStep` over into the *next* call. That accumulator is invisible and
   * harmless for a body at rest, but for anything moving it means the amount of physics time
   * actually simulated in a given `simulate()` call silently drifts above and below that call's own
   * `delta` from tick to tick, depending on the accumulator's leftover phase - since nothing else in
   * this engine's tick loop goes through that same accumulator (a camera driven directly off
   * `CharacterController3dEntity.move()`'s own un-quantized per-tick `dt`, for one), that drift shows
   * up as the camera and a physics-driven body disagreeing by a small, sign-flipping amount every
   * other frame - real, reported, reproduced symptom: back-and-forth position jitter on a
   * `Grabbable3dEntity` held in front of a moving/turning camera (worse the faster the camera
   * moves - the drift is a fixed few milliseconds' worth of position error, so it scales with
   * speed), and the same mechanism behind a fixed camera flickering relative to a moving raycast
   * vehicle, or a chase camera's target flickering relative to its spinning chassis. `Rapier3dWorldComponent.simulate`
   * never has this problem in the first place - it just sets its own `timestep` to `delta` and steps
   * once, so simulated time always exactly equals real elapsed time.
   *
   * Fixed here without giving up bounded substep size at all: `simulate()` computes its own substep
   * count `n = ceil(delta / fixedTimeStep)` (clamped by `maxSubSteps`) and calls `stepSimulation`
   * with substeps of exactly `delta / n` each - always summing to exactly `delta`, every call, with
   * nothing ever carried over. For any `delta` that already divides evenly by `fixedTimeStep` (every
   * existing synthetic test in this package uses one) this reproduces Bullet's own accumulator
   * result exactly; for a real variable render `delta` (never an exact multiple of `0.01`) it's what
   * actually removes the drift, while every substep is still no larger than `fixedTimeStep` (unless
   * `maxSubSteps` itself has to trade accuracy for guaranteeing `delta` is fully consumed - see its
   * own doc). A first attempt at this fix (`maxSubSteps: 0`, Bullet's own single-step "variable
   * timestep" mode, mirroring `Rapier3dWorldComponent.simulate` literally) removed the drift too,
   * but at the cost of *all* substepping, not just the accumulator - confirmed as a real regression,
   * not a hypothetical one, by this package's own test suite: a raycast vehicle's suspension
   * (`ammo-raycast-vehicle.component.spec.ts`) stopped settling correctly and a trigger's exit event
   * (`ammo-trigger.component.spec.ts`) stopped firing, from nothing more exotic than the existing
   * tests' own ordinary `world.simulate(60)`-per-frame loops - well short of a huge catch-up frame.
   * Substep chunking earns its keep for solver accuracy on every call, not just huge ones, so it's
   * kept unconditionally rather than only above some `delta` threshold.
   */
  public fixedTimeStep?: number = 0.01;

  public get dynamicAmmoWorld(): Ammo.btDiscreteDynamicsWorld | undefined {
    return this._dynamicAmmoWorld;
  }

  private collisionConfiguration: Ammo.btDefaultCollisionConfiguration | undefined;
  private dispatcher: Ammo.btCollisionDispatcher | undefined;
  private ghostPairCallback: Ammo.btGhostPairCallback | undefined;
  private broadphase: Ammo.btBroadphaseInterface | undefined;
  private solver: Ammo.btSequentialImpulseConstraintSolver | undefined;
  private gravityVector: Ammo.btVector3 | undefined;
  protected _dynamicAmmoWorld: Ammo.btDiscreteDynamicsWorld | undefined;

  constructor() {
    this.added$.subscribe(c => this.children.push(c));
    this.removed$.subscribe(c => this.children.splice(this.children.indexOf(c), 1));
  }

  async init(): Promise<void> {
    await Ammo.bind(Ammo)(Ammo);
    this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    this.dispatcher = new Ammo.btCollisionDispatcher(this.collisionConfiguration);
    this.broadphase = new Ammo.btDbvtBroadphase();
    this.ghostPairCallback = new Ammo.btGhostPairCallback();
    this.solver = new Ammo.btSequentialImpulseConstraintSolver();
    this.gravityVector = new Ammo.btVector3(this._gravity.x, this._gravity.y, this._gravity.z);

    this._dynamicAmmoWorld = new Ammo.btDiscreteDynamicsWorld(
      this.dispatcher,
      this.broadphase!,
      this.solver,
      this.collisionConfiguration,
    );
    // fix the problem when dynamic objects clip in the static/kinematic objects, moved manually.
    // the problem is introduced in bullet here: https://github.com/bulletphysics/bullet3/commit/96c1ee42565d951347e515e40f41f71d0963d2d0
    this._dynamicAmmoWorld.getSolverInfo().set_m_erp2(0.8);
    this._dynamicAmmoWorld.getPairCache().setInternalGhostPairCallback(this.ghostPairCallback);
    this._dynamicAmmoWorld.setGravity(this.gravityVector);
    this._factory = new AmmoFactory(this);
    this._loader = new AmmoLoader(this);
  }

  simulate(delta: number): void {
    const dt = delta / 1000;
    // Compute our own substep count/size rather than handing `fixedTimeStep`/`maxSubSteps` straight
    // to Bullet's own accumulator-based `stepSimulation` - see `fixedTimeStep`'s own doc for why:
    // in short, an evenly-sized split of *this exact* `dt` never leaves anything for Bullet's
    // accumulator to carry into the next call, which is what eliminates the render/physics timestep
    // drift that caused visible jitter without giving up bounded substep size.
    const maxStep = this.fixedTimeStep && this.fixedTimeStep > 0 ? this.fixedTimeStep : 1 / 60;
    let subSteps = Math.max(1, Math.ceil(dt / maxStep));
    if (this.maxSubSteps) {
      subSteps = Math.min(subSteps, this.maxSubSteps);
    }
    // `dt > 0 ? ... : maxStep`: never hand Bullet a literal `0` for `fixedTimeStep` on a zero-length
    // `dt` call - `m_localTime (0) >= fixedTimeStep` false-ing out safely to "no substeps run" needs
    // a positive divisor, not `0/0`.
    this._dynamicAmmoWorld?.stepSimulation(dt, subSteps, dt > 0 ? dt / subSteps : maxStep);
    this.afterTick$.next();
  }

  protected lockedCollisionGroups: number[] = [];

  registerCollisionGroup(): CollisionGroup {
    for (let i = 1; i < 16; i++) {
      if (!this.lockedCollisionGroups.includes(i)) {
        this.lockedCollisionGroups.push(i);
        return i;
      }
    }
    throw new Error('App tries to register 17th collision group, but ammo.js supports only 16');
  }

  deregisterCollisionGroup(group: CollisionGroup): void {
    this.lockedCollisionGroups = this.lockedCollisionGroups.filter(x => x !== group);
  }

  raycast(options: RaycastOptions<Point3>): RaycastResult<Point3, AmmoRigidBodyComponent | AmmoTriggerComponent> {
    if (!this._dynamicAmmoWorld) {
      return { hasHit: false };
    }
    const from = new Ammo.btVector3(options.from.x, options.from.y, options.from.z);
    const to = new Ammo.btVector3(options.to.x, options.to.y, options.to.z);

    const rayCallback = new Ammo.ClosestRayResultCallback(from, to);

    if (options.collisionFilterGroups) {
      rayCallback.set_m_collisionFilterGroup(BitMask.pack(options.collisionFilterGroups, 16));
    }
    if (options.collisionFilterMask !== undefined) {
      rayCallback.set_m_collisionFilterMask(BitMask.pack(options.collisionFilterMask, 16));
    }
    this._dynamicAmmoWorld.rayTest(from, to, rayCallback);

    const hasHit = rayCallback.hasHit();

    const result: RaycastResult<Point3, any> = { hasHit };

    if (hasHit) {
      result.hitBody = AmmoBodyComponent.nativeBodyReverseMap.get(Ammo.getPointer(rayCallback.get_m_collisionObject()));
      const hitPointAmmo = rayCallback.get_m_hitPointWorld();
      result.hitPoint = {
        x: hitPointAmmo.x(),
        y: hitPointAmmo.y(),
        z: hitPointAmmo.z(),
      };
      const hitNormalAmmo = rayCallback.get_m_hitNormalWorld();
      result.hitNormal = {
        x: hitNormalAmmo.x(),
        y: hitNormalAmmo.y(),
        z: hitNormalAmmo.z(),
      };
      const dx = result.hitPoint.x - options.from.x;
      const dy = result.hitPoint.y - options.from.y;
      const dz = result.hitPoint.z - options.from.z;
      result.hitDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    Ammo.destroy(from);
    Ammo.destroy(to);
    Ammo.destroy(rayCallback);

    if (!hasHit) {
      const solidHit = this.solidRayFallback(options);
      if (solidHit) {
        return solidHit;
      }
    }

    return result;
  }

  /**
   * Bullet's own `rayTest` (used above) can only compute an entry point when the ray *starts*
   * outside its target - once `options.from` is already inside (or has passed all the way through)
   * a convex shape, it finds nothing for that shape at all, from any distance further along the
   * same direction, not just while still inside it (verified empirically: a box shape stops being
   * hittable the instant `from` crosses into it, and stays unhittable for every `from` further past
   * it too). `Rapier3dWorldComponent.raycast` doesn't have this gap - it calls `castRay` with
   * `solid: true`, Rapier's own explicit "report a hit at zero distance on whatever contains the
   * ray's origin" mode - so the exact same query silently behaves differently depending on which
   * physics adapter a world is built with.
   *
   * This came up as a real, reproducible gameplay bug: `ObjectGrabController.tryGrab()` (see its
   * own doc) deliberately starts its pick-up ray a fixed distance in front of the holder's camera
   * to dodge a self-hit on the holder's own capsule - but that same fixed offset can just as easily
   * land *inside* a small grabbable prop sitting closer than that offset, which then became
   * silently ungrabbable on Ammo specifically (working fine on Rapier) the moment the player stood
   * close enough to it - exactly this gap.
   *
   * Fixed by mirroring Rapier's `solid` behavior here too: whenever the plain `rayTest` above found
   * nothing, run one discrete point-overlap probe (`btCollisionWorld.contactTest`, the same
   * discrete-overlap primitive `AmmoCharacterControllerComponent.recoverFromPenetration` already
   * uses for an unrelated reason - see its doc) against a throwaway zero-size collision object
   * placed exactly at `options.from`, and report whatever it overlaps as a hit at distance 0.
   *
   * **`options.collisionFilterGroups`/`collisionFilterMask` are only ever honored here as an
   * *extra* narrowing on top of Bullet's own default pair filtering, never as a way to widen it** -
   * verified empirically, not by reading Bullet's C++ source: `ContactResultCallback`'s own
   * `m_collisionFilterGroup`/`m_collisionFilterMask` fields (which is what its internal
   * `needsCollision` actually checks a candidate's real broadphase proxy against) have no exposed
   * setter on `ConcreteContactResultCallback` in this Ammo.js build - `set_m_collisionFilterGroup`/
   * `set_m_collisionFilterMask` are simply `undefined` on a constructed instance, unlike the same
   * two setters on `ClosestRayResultCallback` (used by the plain `rayTest` above) which do exist.
   * Registering the probe itself with matching group/mask bits via `addCollisionObject` doesn't
   * help either (tried and measured no effect) - only the *candidate's* proxy is ever consulted,
   * against the callback's own fixed default fields (`DefaultFilter`/`AllFilter` in stock Bullet).
   * Net effect: a candidate whose own `interactWithCollisionGroups` excludes this world's
   * default/main group (`mainCollisionGroup`, always group `0`) never reaches this fallback at all,
   * no matter what `options` asks for - an unusual configuration in practice (most bodies keep
   * interacting with the default group even after adding custom ones), and not one the reported
   * bug (`ObjectGrabController.tryGrab()`, which passes no filter at all, against a body left at
   * its own engine-wide default `ownCollisionGroups`/`interactWithCollisionGroups: 'all'`) ever hits
   * - so the manual check below still meaningfully narrows *down* from whatever Bullet's own coarse
   * default let through, it just can't rescue a candidate Bullet's fixed default already excluded
   * before this callback ever ran.
   */
  private solidRayFallback(
    options: RaycastOptions<Point3>,
  ): RaycastResult<Point3, AmmoRigidBodyComponent | AmmoTriggerComponent> | null {
    const collisionWorld = this._dynamicAmmoWorld!;
    const requestedMask =
      options.collisionFilterMask !== undefined ? BitMask.pack(options.collisionFilterMask, 16) : null;
    const requestedGroup = options.collisionFilterGroups ? BitMask.pack(options.collisionFilterGroups, 16) : null;

    const probeShape = new Ammo.btSphereShape(1e-4);
    // `btCollisionObject` itself has no public constructor in this Ammo.js build ("no constructor
    // in IDL") - `btGhostObject` is a plain collision object with one, and nothing about actually
    // being a ghost type matters here (it's never added to the world, so never registered with the
    // ghost-pair callback either).
    const probe = new Ammo.btGhostObject();
    probe.setCollisionShape(probeShape);
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    const origin = new Ammo.btVector3(options.from.x, options.from.y, options.from.z);
    transform.setOrigin(origin);
    probe.setWorldTransform(transform);
    const probePtr = Ammo.getPointer(probe);

    let hitBody: AmmoRigidBodyComponent | AmmoTriggerComponent | undefined;
    let hitNormal: Point3 = { x: 0, y: 0, z: 0 };
    const callback = new Ammo.ConcreteContactResultCallback();
    (callback as unknown as { addSingleResult: (...args: number[]) => number }).addSingleResult = (
      cpPtr: number,
      colObj0WrapPtr: number,
      _partId0: number,
      _index0: number,
      colObj1WrapPtr: number,
    ) => {
      if (hitBody) {
        return 0;
      }
      const AmmoWP = Ammo as unknown as { wrapPointer<T>(ptr: number, type: { new (...args: never[]): T }): T };
      const wrap0 = AmmoWP.wrapPointer(colObj0WrapPtr, Ammo.btCollisionObjectWrapper);
      const weAreObject0 = Ammo.getPointer(wrap0.getCollisionObject()) === probePtr;
      const otherWrapPtr = weAreObject0 ? colObj1WrapPtr : colObj0WrapPtr;
      const otherWrap = AmmoWP.wrapPointer(otherWrapPtr, Ammo.btCollisionObjectWrapper);
      const otherPtr = Ammo.getPointer(otherWrap.getCollisionObject());
      const candidate = AmmoBodyComponent.nativeBodyReverseMap.get(otherPtr) as
        AmmoRigidBodyComponent | AmmoTriggerComponent | undefined;
      if (!candidate) {
        return 0;
      }
      if (requestedMask !== null && (BitMask.pack(candidate.ownCollisionGroups, 16) & requestedMask) === 0) {
        return 0;
      }
      if (requestedGroup !== null && (BitMask.pack(candidate.interactWithCollisionGroups, 16) & requestedGroup) === 0) {
        return 0;
      }
      hitBody = candidate;
      const cp = AmmoWP.wrapPointer(cpPtr, Ammo.btManifoldPoint);
      const n = cp.get_m_normalWorldOnB();
      // `m_normalWorldOnB` always points from object B towards object A - orient it to point from
      // the probe towards the thing it's overlapping, same convention `rayTest`'s own
      // `m_hitNormalWorld` uses, regardless of which side Bullet happened to put the probe on.
      const sign = weAreObject0 ? -1 : 1;
      hitNormal = { x: n.x() * sign, y: n.y() * sign, z: n.z() * sign };
      return 0;
    };

    try {
      collisionWorld.contactTest(probe, callback);
    } finally {
      Ammo.destroy(callback);
      Ammo.destroy(origin);
      Ammo.destroy(transform);
      Ammo.destroy(probe);
      Ammo.destroy(probeShape);
    }

    if (!hitBody) {
      return null;
    }
    return {
      hasHit: true,
      hitBody,
      hitPoint: { ...options.from },
      hitNormal,
      hitDistance: 0,
    };
  }

  dispose(): void {
    this.afterTick$.complete();
    Ammo.destroy(this._dynamicAmmoWorld);
    Ammo.destroy(this.solver);
    Ammo.destroy(this.broadphase);
    Ammo.destroy(this.dispatcher);
    Ammo.destroy(this.collisionConfiguration);
    this._dynamicAmmoWorld = this.solver = this.broadphase = this.dispatcher = this.collisionConfiguration = undefined;
  }
}
