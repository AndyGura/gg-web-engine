import {
  BitMask,
  CharacterController3dOptions,
  CollisionGroup,
  DebugBody3DSettings,
  Entity3d,
  ICharacterController3dComponent,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
} from '@gg-web-engine/core';
import {
  Collider,
  InteractionGroups,
  KinematicCharacterController,
  Quaternion,
  RigidBody,
  RigidBodyDesc,
  Vector3,
} from '@dimforge/rapier3d-compat';
import { Rapier3dWorldComponent } from './rapier-3d-world.component';
import { Rapier3dGgWorld, Rapier3dPhysicsTypeDocRepo } from '../types';

/**
 * A capsule-shaped kinematic character controller backed by Rapier's own `KinematicCharacterController`
 * (`world.createCharacterController`). `move()` is made fully synchronous (see
 * `ICharacterController3dComponent`'s doc for why this matters) by never relying on
 * `setNextKinematicTranslation` + a later `world.step()` to actually reposition the body - the plain
 * (non-"next") `RigidBody.setTranslation`/`setRotation` is used instead, immediately followed by
 * `World.propagateModifiedBodyPositionsToColliders` so the capsule's new position is visible to
 * Rapier's collider state (and thus to the *next* `move()` call, or to any raycast) without needing a
 * simulation step in between. `setNextKinematicTranslation`/`setNextKinematicRotation` are
 * additionally set to the same target so that dynamic bodies pushed by the character still get a
 * reasonable velocity estimate on whatever `world.step()` happens to run afterwards - this is a
 * nice-to-have, not load-bearing for the synchronous contract.
 *
 * Note: a collider only enters Rapier's broad-phase as part of a `World.step()` - a level's static
 * geometry (or this character itself) created and never stepped even once is invisible to `move()`'s
 * sweep test, exactly as it would be to `world.raycast()`. This is a pre-existing engine property, not
 * specific to this component; a normal per-frame game loop that calls `physicsWorld.simulate()`
 * every tick already satisfies it after the first tick.
 *
 * Note: unlike `Rapier3dRigidBodyComponent`/`Rapier3dTriggerComponent`, this component's native body
 * handle is *not* registered in `Rapier3dWorldComponent.handleIdEntityMap` - `world.raycast()` cannot
 * currently resolve a hit against a character controller back to this component (it will simply be
 * absent from `RaycastResult.hitBody`). Wiring that up would require widening the reverse-map's and
 * `raycast()`'s return-type generics repo-wide for a corner case outside this interface's contract;
 * left as a documented limitation rather than done speculatively.
 */
export class Rapier3dCharacterControllerComponent implements ICharacterController3dComponent<Rapier3dPhysicsTypeDocRepo> {
  public entity: Entity3d | null = null;
  public name: string = '';

  public readonly radius: number;
  public readonly centersDistance: number;

  private _up: Point3;

  public get up(): Point3 {
    return this._up;
  }

  public set up(value: Point3) {
    this._up = Pnt3.norm(value);
    this._nativeController?.setUp(new Vector3(this._up.x, this._up.y, this._up.z));
  }

  private _isGrounded: boolean = false;

  public get isGrounded(): boolean {
    return this._isGrounded;
  }

  private _groundNormal: Point3 | null = null;

  public get groundNormal(): Point3 | null {
    return this._groundNormal;
  }

  // Module-wide (not per-instance) so a scene with several characters all being driven without
  // `dt` still only logs once, not once per character per tick - see `pushDynamicBodies`'s
  // missing-`dt` handling below.
  private static warnedMissingDtForPush = false;

  protected _nativeBody: RigidBody | null = null;
  protected _nativeCollider: Collider | null = null;
  protected _nativeController: KinematicCharacterController | null = null;

  public get nativeBody(): RigidBody | null {
    return this._nativeBody;
  }

  public get nativeCollider(): Collider | null {
    return this._nativeCollider;
  }

  public get nativeController(): KinematicCharacterController | null {
    return this._nativeController;
  }

  public readonly debugBodySettings: DebugBody3DSettings;

  public get position(): Point3 {
    return Pnt3.clone(this._nativeBody ? this._nativeBody.translation() : this._bodyDescr.translation);
  }

  public set position(value: Point3) {
    if (this._nativeBody) {
      const v = new Vector3(value.x, value.y, value.z);
      this._nativeBody.setTranslation(v, true);
      this._nativeBody.setNextKinematicTranslation(v);
      this.syncColliderTransform();
    } else {
      this._bodyDescr.setTranslation(value.x, value.y, value.z);
    }
  }

  public get rotation(): Point4 {
    return Qtrn.clone(this._nativeBody ? this._nativeBody.rotation() : this._bodyDescr.rotation);
  }

  public set rotation(value: Point4) {
    if (this._nativeBody) {
      const q = new Quaternion(value.x, value.y, value.z, value.w);
      this._nativeBody.setRotation(q, true);
      this._nativeBody.setNextKinematicRotation(q);
      this.syncColliderTransform();
    } else {
      this._bodyDescr.setRotation(new Quaternion(value.x, value.y, value.z, value.w));
    }
  }

  protected collisionGroups: InteractionGroups = BitMask.full(32);

  public get interactWithCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return BitMask.unpack(this.collisionGroups, 16);
  }

  public set interactWithCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    let mask = value === 'all' ? BitMask.full(16) : BitMask.pack(value, 16);
    mask = mask | (this.collisionGroups & (BitMask.full(16) << 16));
    if (mask === this.collisionGroups) {
      return;
    }
    this.collisionGroups = mask;
    this._nativeCollider?.setCollisionGroups(this.collisionGroups);
  }

  public get ownCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return BitMask.unpack(this.collisionGroups >> 16, 16);
  }

  public set ownCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    let mask = value === 'all' ? BitMask.full(16) : BitMask.pack(value, 16);
    mask = (mask << 16) | (this.collisionGroups & BitMask.full(16));
    if (mask === this.collisionGroups) {
      return;
    }
    this.collisionGroups = mask;
    this._nativeCollider?.setCollisionGroups(this.collisionGroups);
  }

  constructor(
    protected readonly world: Rapier3dWorldComponent,
    protected readonly options: Required<CharacterController3dOptions>,
    protected _bodyDescr: RigidBodyDesc,
  ) {
    this.radius = options.radius;
    this.centersDistance = options.centersDistance;
    this._up = Pnt3.norm(options.up);
    this.debugBodySettings = new DebugBody3DSettings(
      { type: 'RIGID_DYNAMIC', sleeping: () => false },
      { shape: 'CAPSULE', radius: this.radius, centersDistance: this.centersDistance },
    );
    this.ownCollisionGroups = options.ownCollisionGroups;
    this.interactWithCollisionGroups = options.interactWithCollisionGroups;
  }

  /**
   * Makes any position/rotation change applied directly to `_nativeBody` (outside of `move()`, e.g.
   * via the `position`/`rotation` setters) immediately visible to Rapier's collider state, without
   * requiring a `world.step()` - see the class doc for why this matters. The pinned
   * `@dimforge/rapier3d-compat` build only exposes `propagateModifiedBodyPositionsToColliders()` for
   * this (no separate `QueryPipeline`/`updateSceneQueries` object to rebuild - the character
   * controller queries `World`'s live `broadPhase`/`narrowPhase` directly), so that's the only call
   * needed here.
   */
  private syncColliderTransform(): void {
    this.world.nativeWorld.propagateModifiedBodyPositionsToColliders();
  }

  move(desiredTranslation: Point3, dt?: number): void {
    if (!this._nativeBody || !this._nativeCollider || !this._nativeController) {
      // not yet added to the world - nothing to sweep against (matches
      // `AmmoCharacterControllerComponent.move`'s no-op contract, see `ICharacterController3dComponent`)
      return;
    }
    // make sure collider positions reflect any obstacle moved (by anything) since the last
    // world.step()/propagate call, so the upcoming sweep test is accurate
    this.syncColliderTransform();

    // Rapier's own snap-to-ground, left enabled unconditionally, would otherwise undo a jump
    // takeoff the very next tick: `computeColliderMovement` treats a character within
    // `snapToGroundDistance` of the floor it just left as still grounded and pulls it right back
    // down onto it, and a jump's own per-tick rise (`jumpSpeed * dt`) starts out far smaller than
    // the default 0.3 snap distance - so every jump was silently cancelled before it ever left the
    // ground. This is the exact same failure mode `AmmoCharacterControllerComponent`'s own
    // hand-rolled mover hit and fixed (see that class's `move()` doc's `movingUp` guard); toggling
    // snap-to-ground off for ticks that are actively rising, back on otherwise, mirrors it here.
    //
    // Autostep needs the identical guard, for a related but distinct reason: it only misbehaves
    // while jumping *and* simultaneously blocked horizontally by something taller than
    // `maxStepHeight` (e.g. running at a barrier and jumping right as you reach it, rather than
    // jumping in open space) - confirmed empirically, a jump that looked perfect in the open turned
    // into a small up-then-snap-back-down "flick" the instant the same jump was attempted pressed
    // up against such an obstacle, the rise stopping right around `maxStepHeight` itself before
    // reverting to standing height. Autostep's own "raise up to maxStepHeight, retry the blocked
    // horizontal move, keep the raise only if that retry actually clears" evaluation runs as part of
    // the very same `computeColliderMovement` call handling the jump's vertical component - when the
    // retry still doesn't clear (barrier taller than the raise), whatever it does to "give back" the
    // failed step attempt isn't scoped to just the horizontal axis, so it cancels the deliberate
    // vertical rise sharing that same call too. There's no real reason to want auto-step-climbing
    // active while already deliberately jumping, so disable it under the same condition.
    const movingUp = Pnt3.dot(desiredTranslation, this._up) > 1e-9;
    if (movingUp) {
      this._nativeController.disableSnapToGround();
      this._nativeController.disableAutostep();
    } else {
      if (this.options.snapToGroundDistance > 0) {
        this._nativeController.enableSnapToGround(this.options.snapToGroundDistance);
      }
      if (this.options.maxStepHeight > 0) {
        this._nativeController.enableAutostep(this.options.maxStepHeight, this.options.minStepWidth, true);
      }
    }

    const desired = new Vector3(desiredTranslation.x, desiredTranslation.y, desiredTranslation.z);
    this._nativeController.computeColliderMovement(this._nativeCollider, desired);
    const computed = this._nativeController.computedMovement();
    const current = this._nativeBody.translation();
    const next = new Vector3(current.x + computed.x, current.y + computed.y, current.z + computed.z);

    this._nativeBody.setTranslation(next, true);
    this._nativeBody.setNextKinematicTranslation(next);
    this.syncColliderTransform();

    this._isGrounded = this._nativeController.computedGrounded();
    this._groundNormal = this.computeGroundNormal();

    this.pushDynamicBodies(desiredTranslation, dt);
  }

  /**
   * Shoves any dynamic body this tick's sweep bumped into - see `addToWorld`'s doc for why this is
   * hand-rolled rather than Rapier's own `setApplyImpulsesToDynamicBodies`. Mirrors
   * `AmmoCharacterControllerComponent.pushDynamicBody` exactly: models the contact as a simple
   * inelastic collision against a virtual body of mass `options.pushMass` moving at `characterSpeed`
   * (this tick's *horizontal* displacement - vertical/jump motion never pushes anything sideways -
   * converted to a real m/s via `dt`, not a raw per-tick distance), driving the hit body's velocity
   * along the push direction towards `characterSpeed * pushMass / (pushMass + bodyMass)` and only
   * ever adding forward velocity, never removing any (so a body already outrunning the character in
   * that direction is left alone). `computedCollision()` already has everything needed - populated
   * by the `computeColliderMovement` call above regardless of this method's own logic, so no extra
   * sweep/query is needed to reach it.
   */
  private pushDynamicBodies(desiredTranslation: Point3, dt: number | undefined): void {
    const pushMass = this.options.pushMass;
    if (pushMass <= 0 || !this._nativeController) {
      return;
    }
    const vertical = Pnt3.scalarMult(this._up, Pnt3.dot(desiredTranslation, this._up));
    const horizontal = Pnt3.sub(desiredTranslation, vertical);
    const horizLen = Pnt3.len(horizontal);
    if (horizLen <= 1e-9) {
      return;
    }
    // `dt` is required to recover a real m/s speed from `horizLen` (see
    // `ICharacterController3dComponent.move()`'s doc). Falling back to the raw per-tick
    // displacement as if it were already a speed would understate push force by roughly a factor of
    // `dt` - silently wrong, not just imprecise - so skip the push for this tick instead when `dt`
    // isn't available, same as `AmmoCharacterControllerComponent.pushDynamicBody`.
    if (!dt || dt <= 1e-9) {
      if (!Rapier3dCharacterControllerComponent.warnedMissingDtForPush) {
        Rapier3dCharacterControllerComponent.warnedMissingDtForPush = true;
        console.warn(
          '[Rapier3dCharacterControllerComponent] move() was called without `dt` while `pushMass` > ' +
            '0 - skipping this dynamic-body push rather than approximating character speed from raw ' +
            'per-tick displacement (which would understate push force by roughly 1/dt). Pass the ' +
            'real tick delta (seconds) as the third argument to move() to enable pushing dynamic bodies.',
        );
      }
      return;
    }
    const direction = Pnt3.scalarMult(horizontal, 1 / horizLen);
    const characterSpeed = horizLen / dt;

    const count = this._nativeController.numComputedCollisions();
    for (let i = 0; i < count; i++) {
      const collision = this._nativeController.computedCollision(i);
      const body = collision?.collider?.parent();
      if (!body || !body.isDynamic()) {
        continue;
      }
      const bodyMass = body.mass();
      if (bodyMass <= 0) {
        continue;
      }
      const pushSpeed = characterSpeed * (pushMass / (pushMass + bodyMass));
      const v = body.linvel();
      const currentAlong = v.x * direction.x + v.y * direction.y + v.z * direction.z;
      if (pushSpeed <= currentAlong) {
        continue;
      }
      const delta = pushSpeed - currentAlong;
      body.setLinvel(
        { x: v.x + direction.x * delta, y: v.y + direction.y * delta, z: v.z + direction.z * delta },
        true,
      );
    }
  }

  /**
   * Rapier's character controller doesn't expose a single "ground normal" directly - only a list of
   * per-obstacle collisions (`computedCollision`) from the last `computeColliderMovement` call, each
   * with its own contact normal. Best-effort approach: scan those collisions for one whose normal
   * points roughly the same way as `up` (i.e. a floor-like surface, not a wall) and use that; fall
   * back to the plain `up` vector if grounded but no such collision was recorded (e.g. snapped to
   * ground without an explicit sweep collision that tick), or `null` if not grounded at all.
   */
  private computeGroundNormal(): Point3 | null {
    if (!this._isGrounded || !this._nativeController) {
      return null;
    }
    const count = this._nativeController.numComputedCollisions();
    for (let i = 0; i < count; i++) {
      const collision = this._nativeController.computedCollision(i);
      if (collision?.normal1 && Pnt3.dot(Pnt3.clone(collision.normal1), this._up) > 0.1) {
        return Pnt3.clone(collision.normal1);
      }
    }
    return Pnt3.clone(this._up);
  }

  clone(): Rapier3dCharacterControllerComponent {
    // read the CURRENT position/rotation, not `_bodyDescr`'s construction-time values - once
    // `_nativeBody` exists, the `position`/`rotation` setters write straight to it and never touch
    // `_bodyDescr` again (see those setters above), so `_bodyDescr` alone would be stale for any
    // controller that has moved since being added to the world.
    const pos = this.position;
    const rot = this.rotation;
    const bd = RigidBodyDesc.kinematicPositionBased();
    bd.setTranslation(pos.x, pos.y, pos.z);
    bd.setRotation(new Quaternion(rot.x, rot.y, rot.z, rot.w));
    const comp = new Rapier3dCharacterControllerComponent(this.world, this.options, bd);
    comp.collisionGroups = this.collisionGroups;
    return comp;
  }

  addToWorld(world: Rapier3dGgWorld): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier3D bodies cannot be shared between different worlds');
    }
    const nativeWorld = this.world.nativeWorld;
    this._nativeBody = nativeWorld.createRigidBody(this._bodyDescr);
    const colliderDescr = this.world.factory.createColliderDescr({
      shape: 'CAPSULE',
      radius: this.radius,
      centersDistance: this.centersDistance,
    })[0];
    this._nativeCollider = nativeWorld.createCollider(colliderDescr, this._nativeBody);
    this._nativeCollider.setCollisionGroups(this.collisionGroups);

    this._nativeController = nativeWorld.createCharacterController(this.options.offset);
    this._nativeController.setUp(new Vector3(this._up.x, this._up.y, this._up.z));
    this._nativeController.setMaxSlopeClimbAngle(this.options.maxSlopeClimbAngleRad);
    if (this.options.maxStepHeight > 0) {
      this._nativeController.enableAutostep(this.options.maxStepHeight, this.options.minStepWidth, true);
    }
    if (this.options.snapToGroundDistance > 0) {
      this._nativeController.enableSnapToGround(this.options.snapToGroundDistance);
    }
    // Rapier's own `KinematicCharacterController` has a built-in equivalent of `pushMass`
    // (`setApplyImpulsesToDynamicBodies(true)` + `setCharacterMass(...)`) that looked like the
    // obvious way to implement pushing here - no hand-rolled logic needed, unlike
    // `AmmoCharacterControllerComponent` (whose ghost-based mover has no native equivalent at all).
    // It was tried first, but is deliberately **not** used: confirmed empirically, enabling it on
    // this kinematic-position-based character body doesn't just get the push physics wrong (mass
    // ordering inverted - a *heavier* box ended up moving further than a lighter one at otherwise
    // identical settings) but genuinely explodes - a pushed box's position jumped by 5+ meters in a
    // single 16ms tick and kept climbing indefinitely tick after tick, not settling. Root cause not
    // fully identified (plausibly `characterMass`'s override interacting badly with this body's own
    // `mass()`, which a kinematic body reports as `0`, somewhere in Rapier's impulse resolution -
    // not something this package's pinned `@dimforge/rapier3d-compat` build exposes enough to debug
    // further from JS). `pushDynamicBodies` below is a hand-rolled equivalent instead, mirroring
    // `AmmoCharacterControllerComponent.pushDynamicBody`'s own formula and contract exactly (down to
    // the same `pushMass <= 0` "disable pushing" convention) - built on `computedCollision()`, which
    // `computeColliderMovement` already populates every `move()` call regardless of this native
    // feature being enabled, so no extra query is needed to reach it.

    this.world.added$.next(this);
  }

  removeFromWorld(world: Rapier3dGgWorld, dispose?: boolean): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier3D bodies cannot be shared between different worlds');
    }
    if (this._nativeController) {
      this.world.nativeWorld.removeCharacterController(this._nativeController);
      this._nativeController = null;
    }
    if (this._nativeBody) {
      if (this._nativeCollider) {
        this.world.nativeWorld.removeCollider(this._nativeCollider, false);
        this._nativeCollider = null;
      }
      this.world.nativeWorld.removeRigidBody(this._nativeBody);
      this._nativeBody = null;
    }
    this.world.removed$.next(this);
  }

  dispose(): void {
    if (this._nativeBody) {
      this.removeFromWorld({ physicsWorld: this.world } as any as Rapier3dGgWorld, true);
    }
  }
}
