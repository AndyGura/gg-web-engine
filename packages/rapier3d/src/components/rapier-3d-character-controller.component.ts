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
  public name: string = 'character-controller';

  public readonly radius: number;
  public readonly centersDistance: number;

  private _up: Point3;

  public get up(): Point3 {
    return this._up;
  }

  public set up(value: Point3) {
    this._up = value;
    this._nativeController?.setUp(new Vector3(value.x, value.y, value.z));
  }

  private _isGrounded: boolean = false;

  public get isGrounded(): boolean {
    return this._isGrounded;
  }

  private _groundNormal: Point3 | null = null;

  public get groundNormal(): Point3 | null {
    return this._groundNormal;
  }

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
    this._up = options.up;
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

  move(desiredTranslation: Point3): void {
    if (!this._nativeBody || !this._nativeCollider || !this._nativeController) {
      throw new Error('Cannot move a character controller which is not added to the world');
    }
    // make sure collider positions reflect any obstacle moved (by anything) since the last
    // world.step()/propagate call, so the upcoming sweep test is accurate
    this.syncColliderTransform();

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
    const bd = RigidBodyDesc.kinematicPositionBased();
    bd.setTranslation(this._bodyDescr.translation.x, this._bodyDescr.translation.y, this._bodyDescr.translation.z);
    bd.setRotation({ ...this._bodyDescr.rotation });
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

    this.world.added$.next(this);
  }

  removeFromWorld(world: Rapier3dGgWorld): void {
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
      this.removeFromWorld({ physicsWorld: this.world } as any as Rapier3dGgWorld);
    }
  }
}
