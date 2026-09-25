import {
  BitMask,
  Body3DOptions,
  BodyOptions,
  BodyType,
  CollisionEvent,
  CollisionGroup,
  DebugBody3DSettings,
  Entity3d,
  IRigidBody3dComponent,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  Shape3DDescriptor,
} from '@gg-web-engine/core';
import {
  Collider,
  ColliderDesc,
  InteractionGroups,
  Quaternion,
  RigidBody,
  RigidBodyDesc,
  RigidBodyType,
  Vector3,
} from '@dimforge/rapier3d-compat';
import { Observable, Subject } from 'rxjs';
import { Rapier3dWorldComponent } from './rapier-3d-world.component';
import { Rapier3dGgWorld, Rapier3dPhysicsTypeDocRepo } from '../types';

/** Inverse of `Rapier3dFactory.createRigidBodyDescr`'s own `BodyType -> RigidBodyType` mapping -
 * backs `Rapier3dRigidBodyComponent.bodyOptions`. */
function rapierBodyTypeToBodyType(status: RigidBodyType): BodyType {
  switch (status) {
    case RigidBodyType.Fixed:
      return 'static';
    case RigidBodyType.KinematicPositionBased:
      return 'kinematic_pos';
    case RigidBodyType.KinematicVelocityBased:
      return 'kinematic_vel';
    default:
      return 'dynamic';
  }
}

export class Rapier3dRigidBodyComponent implements IRigidBody3dComponent<Rapier3dPhysicsTypeDocRepo> {
  public entity: Entity3d | null = null;

  public get position(): Point3 {
    return Pnt3.clone(this.nativeBody ? this.nativeBody.translation() : this._bodyDescr.translation);
  }

  public set position(value: Point3) {
    if (this.nativeBody) {
      // A `kinematicPositionBased` body must move through `setNextKinematicTranslation` rather
      // than the immediate teleport `setTranslation` does - only that path lets Rapier derive the
      // body's effective velocity for this step and correctly push/wake dynamic bodies in its way
      // (see `BodyOptions.kinematic_pos`'s own doc, and the "plain teleport" pitfall it links to).
      // `kinematicVelocityBased` and `dynamic` bodies keep the immediate teleport - the former is
      // already driven by `linearVelocity` each step, not by `position` writes.
      if (this.nativeBody.bodyType() === RigidBodyType.KinematicPositionBased) {
        this.nativeBody.setNextKinematicTranslation(new Vector3(value.x, value.y, value.z));
      } else {
        this.nativeBody.setTranslation(new Vector3(value.x, value.y, value.z), true);
      }
    } else {
      this._bodyDescr.setTranslation(value.x, value.y, value.z);
    }
  }

  public get rotation(): Point4 {
    return Qtrn.clone(this.nativeBody ? this.nativeBody.rotation() : this._bodyDescr.rotation);
  }

  public set rotation(value: Point4) {
    if (this.nativeBody) {
      // see `position`'s setter above for why a kinematic-position-based body needs the "next
      // kinematic" API instead of an immediate teleport.
      if (this.nativeBody.bodyType() === RigidBodyType.KinematicPositionBased) {
        this.nativeBody.setNextKinematicRotation(new Quaternion(value.x, value.y, value.z, value.w));
      } else {
        this.nativeBody.setRotation(new Quaternion(value.x, value.y, value.z, value.w), true);
      }
    } else {
      this._bodyDescr.setRotation(new Quaternion(value.x, value.y, value.z, value.w));
    }
  }

  get linearVelocity(): Point3 {
    return Pnt3.clone(this.nativeBody?.linvel() || Pnt3.O);
  }

  set linearVelocity(value: Point3) {
    if (this.nativeBody) {
      // see `position`'s setter above for why `true` (wake up) is required
      this.nativeBody.setLinvel(new Vector3(value.x, value.y, value.z), true);
    }
  }

  get angularVelocity(): Point3 {
    return Pnt3.clone(this.nativeBody?.angvel() || Pnt3.O);
  }

  set angularVelocity(value: Point3) {
    if (this.nativeBody) {
      // see `position`'s setter above for why `true` (wake up) is required
      this.nativeBody.setAngvel(new Vector3(value.x, value.y, value.z), true);
    }
  }

  readonly debugBodySettings: DebugBody3DSettings = new DebugBody3DSettings(
    this._bodyDescr.status == RigidBodyType.Fixed
      ? { type: 'RIGID_STATIC' }
      : this._bodyDescr.status == RigidBodyType.Dynamic
        ? { type: 'RIGID_DYNAMIC', sleeping: () => !!this._nativeBody?.isSleeping() }
        : { type: 'RIGID_KINEMATIC' },
    this.shape,
  );

  /**
   * See `IRigidBodyComponent.bodyOptions`'s own doc. Reads straight off `_bodyDescr`/
   * `_colliderOptions` (also what `addToWorld` itself builds the native body/colliders from, and
   * what `factoryProps`/`clone()` already round-trip) rather than the native body/colliders - this
   * engine's own API never mutates any of `bodyType`/`mass`/`friction`/`restitution`/`ccd` after
   * construction, so the stored descriptor is exactly as accurate as a native query would be.
   */
  get bodyOptions(): Readonly<BodyOptions> {
    return {
      bodyType: rapierBodyTypeToBodyType(this._bodyDescr.status),
      mass: this._bodyDescr.mass,
      friction: this._colliderOptions.friction,
      restitution: this._colliderOptions.restitution,
      ccd: this._bodyDescr.ccdEnabled,
      ownCollisionGroups: this.ownCollisionGroups,
      interactWithCollisionGroups: this.interactWithCollisionGroups,
    };
  }

  protected _nativeBody: RigidBody | null = null;
  protected _nativeBodyColliders: Collider[] | null = null;

  get nativeBody(): RigidBody | null {
    return this._nativeBody;
  }

  set nativeBody(value: RigidBody | null) {
    if (value == this._nativeBody || !value) {
      return;
    }
    this._nativeBody = value;
  }

  public name: string = '';

  /**
   * Other rigid-body components this one is currently touching via a real (non-sensor) contact -
   * mirrors `Rapier3dTriggerComponent.overlaps`, but symmetric: both sides of an ordinary collision
   * get notified, so both sides track it. Populated/drained by `Rapier3dWorldComponent`'s centralized
   * collision-event dispatch (see `notifyCollisionStart`/`notifyCollisionEnd` below), and consulted by
   * `removeFromWorld` to emit `onCollisionEnd(null)` to any partner still touching this body at the
   * moment it's removed (per `CollisionEvent`'s "null when the other body was removed from the world
   * while still in contact" convention) - Rapier does not reliably emit a native collision-stop event
   * for a collider that's simply deleted mid-contact (same reason `Rapier3dTriggerComponent.
   * checkOverlaps` has its own manual `!body.nativeBody` cleanup pass instead of trusting the event
   * queue for that case).
   */
  public readonly collidingWith: Set<Rapier3dRigidBodyComponent> = new Set();

  protected readonly onCollisionStart$: Subject<CollisionEvent<Point3, Rapier3dRigidBodyComponent>> = new Subject<
    CollisionEvent<Point3, Rapier3dRigidBodyComponent>
  >();
  protected readonly onCollisionEnd$: Subject<Rapier3dRigidBodyComponent | null> =
    new Subject<Rapier3dRigidBodyComponent | null>();

  get onCollisionStart(): Observable<CollisionEvent<Point3, Rapier3dRigidBodyComponent>> {
    return this.onCollisionStart$.asObservable();
  }

  get onCollisionEnd(): Observable<Rapier3dRigidBodyComponent | null> {
    return this.onCollisionEnd$.asObservable();
  }

  /**
   * Called by `Rapier3dWorldComponent`'s centralized collision-event dispatch (see
   * `Rapier3dWorldComponent.simulate`) - not meant to be called by app code directly. Kept `public`
   * (rather than some cross-class-accessible `protected`) purely because the dispatching class isn't
   * a subclass of this one; there's nothing else in this package it's meant to be called from.
   */
  public notifyCollisionStart(event: CollisionEvent<Point3, Rapier3dRigidBodyComponent>): void {
    this.collidingWith.add(event.otherBody);
    this.onCollisionStart$.next(event);
  }

  /** See `notifyCollisionStart`'s doc. `otherBody: null` signals the partner was removed from the
   *  world while still in contact, per `onCollisionEnd`'s doc. */
  public notifyCollisionEnd(otherBody: Rapier3dRigidBodyComponent | null): void {
    if (otherBody) {
      this.collidingWith.delete(otherBody);
    }
    this.onCollisionEnd$.next(otherBody);
  }

  public get factoryProps(): [
    ColliderDesc[],
    Shape3DDescriptor,
    RigidBodyDesc,
    Omit<Omit<Body3DOptions, 'bodyType'>, 'mass'>,
  ] {
    const colliderDescr = this._colliderDescr.map(cd => {
      const d = new ColliderDesc(cd.shape);
      d.setTranslation(cd.translation.x, cd.translation.y, cd.translation.z);
      d.setRotation({ ...cd.rotation });
      d.setMassProperties(cd.mass, cd.centerOfMass, cd.principalAngularInertia, cd.angularInertiaLocalFrame);
      d.setFriction(cd.friction);
      d.setEnabled(cd.enabled);
      d.setRestitution(cd.restitution);
      // TODO more fields here?
      return d;
    });
    const bd = new RigidBodyDesc(this._bodyDescr.status);
    bd.mass = this._bodyDescr.mass;
    bd.setTranslation(this._bodyDescr.translation.x, this._bodyDescr.translation.y, this._bodyDescr.translation.z);
    bd.setRotation({ ...this._bodyDescr.rotation });
    // `ccdEnabled` is a plain field on `RigidBodyDesc` (not copied by the constructor above), not
    // just a constructor-only `setCcdEnabled` call - carry it over explicitly so `clone()` doesn't
    // silently drop CCD off the copy.
    bd.setCcdEnabled(this._bodyDescr.ccdEnabled);
    // TODO more fields here?
    return [colliderDescr, this.shape, bd, this._colliderOptions];
  }

  constructor(
    protected readonly world: Rapier3dWorldComponent,
    protected _colliderDescr: ColliderDesc[],
    public readonly shape: Shape3DDescriptor,
    protected _bodyDescr: RigidBodyDesc,
    protected _colliderOptions: Omit<Omit<Body3DOptions, 'bodyType'>, 'mass'>,
  ) {
    this.ownCollisionGroups = _colliderOptions?.ownCollisionGroups || [world.mainCollisionGroup];
    this.interactWithCollisionGroups = _colliderOptions?.interactWithCollisionGroups || [world.mainCollisionGroup];
  }

  protected collisionGroups: InteractionGroups = BitMask.full(32);

  get interactWithCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return BitMask.unpack(this.collisionGroups, 16);
  }

  set interactWithCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    let mask;
    if (value === 'all') {
      mask = BitMask.full(16);
    } else {
      mask = BitMask.pack(value, 16);
    }
    mask = mask | (this.collisionGroups & (BitMask.full(16) << 16));
    if (mask === this.collisionGroups) {
      return;
    }
    this.collisionGroups = mask;
    if (this.nativeBody) {
      for (let i = 0; i < this.nativeBody.numColliders(); i++) {
        this.nativeBody.collider(i).setCollisionGroups(this.collisionGroups);
      }
    }
  }

  get ownCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return BitMask.unpack(this.collisionGroups >> 16, 16);
  }

  set ownCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    let mask;
    if (value === 'all') {
      mask = BitMask.full(16);
    } else {
      mask = BitMask.pack(value, 16);
    }
    mask = (mask << 16) | (this.collisionGroups & BitMask.full(16));
    if (mask === this.collisionGroups) {
      return;
    }
    this.collisionGroups = mask;
    if (this.nativeBody) {
      for (let i = 0; i < this.nativeBody.numColliders(); i++) {
        this.nativeBody.collider(i).setCollisionGroups(this.collisionGroups);
      }
    }
  }

  clone(): Rapier3dRigidBodyComponent {
    const comp = new Rapier3dRigidBodyComponent(this.world, ...this.factoryProps);
    comp.collisionGroups = this.collisionGroups;
    return comp;
  }

  addToWorld(world: Rapier3dGgWorld): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier3D bodies cannot be shared between different worlds');
    }
    this._nativeBody = this.world.nativeWorld!.createRigidBody(this._bodyDescr);
    this._nativeBodyColliders = this._colliderDescr.map(c => {
      const col = this.world.nativeWorld!.createCollider(c, this._nativeBody!);
      col.setFriction(this._colliderOptions.friction);
      col.setRestitution(this._colliderOptions.restitution);
      col.setCollisionGroups(this.collisionGroups);
      return col;
    });
    this.world.handleIdEntityMap.set(this._nativeBody!.handle, this);
    this.world.added$.next(this);
  }

  removeFromWorld(world: Rapier3dGgWorld, dispose?: boolean): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier3D bodies cannot be shared between different worlds');
    }
    // notify every body still touching this one that the contact ended because *this* body vanished
    // (not because they physically separated) - see `collidingWith`'s doc.
    for (const other of this.collidingWith) {
      other.collidingWith.delete(this);
      other.notifyCollisionEnd(null);
    }
    this.collidingWith.clear();
    if (this._nativeBody) {
      for (const col of this._nativeBodyColliders!) {
        this.world.nativeWorld!.removeCollider(col, false);
      }
      this.world.nativeWorld!.removeRigidBody(this._nativeBody);
      this.world.handleIdEntityMap.delete(this._nativeBody.handle);
      this._nativeBody = null;
      this._nativeBodyColliders = null;
    }
    this.world.removed$.next(this);
  }

  resetMotion(): void {
    this._nativeBody!.setAngvel(new Vector3(0, 0, 0), false);
    this._nativeBody!.setLinvel(new Vector3(0, 0, 0), false);
  }

  dispose(): void {
    if (this.nativeBody) {
      this.removeFromWorld({ physicsWorld: this.world } as any as Rapier3dGgWorld, true);
    }
    this.onCollisionStart$.complete();
    this.onCollisionEnd$.complete();
  }
}
