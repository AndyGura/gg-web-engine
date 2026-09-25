import {
  BitMask,
  BodyOptions,
  BodyType,
  CollisionEvent,
  CollisionGroup,
  DebugBody2DSettings,
  Entity2d,
  IRigidBody2dComponent,
  Pnt2,
  Point2,
  Shape2DDescriptor,
} from '@gg-web-engine/core';
import { Body, Composite, Vector } from 'matter-js';
import { Observable, Subject } from 'rxjs';
import { MatterGgWorld, MatterPhysicsTypeDocRepo } from '../types';

// FIXME why this needs to be introduced? investigate units in matter.js
const MATTER_VELOCITY_SCALE = 0.0166667;

export class MatterRigidBodyComponent implements IRigidBody2dComponent<MatterPhysicsTypeDocRepo> {
  public get position(): Point2 {
    return Pnt2.clone(this.nativeBody.position);
  }

  public set position(value: Point2) {
    Body.setPosition(this.nativeBody, Vector.create(value.x, value.y));
  }

  public get rotation(): number {
    return this.nativeBody.angle;
  }

  public set rotation(value: number) {
    this.nativeBody.angle = value;
  }

  get linearVelocity(): Point2 {
    return Pnt2.scalarMult(this.nativeBody.velocity, 1 / MATTER_VELOCITY_SCALE);
  }

  set linearVelocity(value: Point2) {
    Body.setVelocity(this.nativeBody, Vector.create(value.x * MATTER_VELOCITY_SCALE, value.y * MATTER_VELOCITY_SCALE));
  }

  get angularVelocity(): number {
    return this.nativeBody.angularVelocity;
  }

  set angularVelocity(value: number) {
    Body.setAngularVelocity(this.nativeBody, value);
  }

  public name: string = '';

  public entity: Entity2d | null = null;

  // matter-js has no native kinematic body - a body requested as `kinematic_pos`/`kinematic_vel`
  // is physically an ordinary `isStatic: true` body under the hood (see `MatterFactory
  // .transformOptions`'s own doc), so the debug view reports what it actually *is* (`RIGID_STATIC`)
  // rather than what an app originally asked for - the console warning at creation time is what
  // tells a developer their kinematic request wasn't honored, not this view.
  readonly debugBodySettings: DebugBody2DSettings = new DebugBody2DSettings(
    isFinite(this.nativeBody.mass)
      ? { type: 'RIGID_DYNAMIC', sleeping: () => this.nativeBody.isSleeping }
      : { type: 'RIGID_STATIC' },
    this.shape,
  );

  /**
   * See `IRigidBodyComponent.bodyOptions`'s own doc. `mass`/`friction`/`restitution` are read live
   * off the native matter-js body (a plain JS object - `.mass`/`.friction`/`.restitution` are
   * ordinary fields, resolved to matter-js's own defaults by `Body.create` for whichever of them
   * weren't explicitly given, so this reflects the body's *actual* resolved values, not just
   * whatever was requested). `bodyType`/`ccd` are stored as originally requested rather than
   * derived from the native body: matter-js has no kinematic body concept at all (a requested
   * `kinematic_pos`/`kinematic_vel` degrades to a plain `isStatic` body - see `MatterFactory
   * .transformOptions`'s own doc) and no CCD, so neither is recoverable from - or even meaningfully
   * "live" on - the native body itself; echoing the request instead keeps a level JSON reloaded
   * under a different, kinematic/CCD-capable adapter faithful to what was actually asked for.
   */
  get bodyOptions(): Readonly<BodyOptions> {
    return {
      bodyType: this.bodyType,
      mass: this.nativeBody.mass,
      friction: this.nativeBody.friction,
      restitution: this.nativeBody.restitution,
      ccd: this.ccd,
      ownCollisionGroups: this.ownCollisionGroups,
      interactWithCollisionGroups: this.interactWithCollisionGroups,
    };
  }

  protected _interactWithCGsMask = BitMask.full(16);
  protected _ownCGsMask = BitMask.full(16);

  get onCollisionStart(): Observable<CollisionEvent<Point2, MatterRigidBodyComponent>> {
    return this.onCollisionStart$.asObservable();
  }

  get onCollisionEnd(): Observable<MatterRigidBodyComponent | null> {
    return this.onCollisionEnd$.asObservable();
  }

  protected readonly onCollisionStart$: Subject<CollisionEvent<Point2, MatterRigidBodyComponent>> = new Subject<
    CollisionEvent<Point2, MatterRigidBodyComponent>
  >();
  protected readonly onCollisionEnd$: Subject<MatterRigidBodyComponent | null> =
    new Subject<MatterRigidBodyComponent | null>();

  /** Other rigid bodies this body is currently touching (non-sensor contact only), tracked so
   * `removeFromWorld` can tell them apart to emit `onCollisionEnd(null)` per that member's
   * documented "other body removed while still in contact" case. Maintained exclusively via
   * `notifyCollisionStart`/`notifyCollisionEnd`, called by `MatterWorldComponent`'s single
   * world-wide `collisionStart`/`collisionEnd` listener - not touched directly by anything else. */
  protected readonly currentContacts: Set<MatterRigidBodyComponent> = new Set();

  constructor(
    public nativeBody: Body,
    public readonly shape: Shape2DDescriptor,
    public readonly bodyType: BodyType = 'dynamic',
    public readonly ccd: boolean = false,
  ) {
    this.updateCollisionFilter();
  }

  /** @internal called by `MatterWorldComponent`'s global `collisionStart` listener - not part of
   * this component's public API surface. */
  notifyCollisionStart(collisionEvent: CollisionEvent<Point2, MatterRigidBodyComponent>): void {
    this.currentContacts.add(collisionEvent.otherBody);
    this.onCollisionStart$.next(collisionEvent);
  }

  /** @internal called by `MatterWorldComponent`'s global `collisionEnd` listener - not part of
   * this component's public API surface. */
  notifyCollisionEnd(otherBody: MatterRigidBodyComponent | null): void {
    if (otherBody) {
      this.currentContacts.delete(otherBody);
    }
    this.onCollisionEnd$.next(otherBody);
  }

  get interactWithCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return BitMask.unpack(this._interactWithCGsMask, 16);
  }

  set interactWithCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    let mask;
    if (value === 'all') {
      mask = BitMask.full(16);
    } else {
      mask = BitMask.pack(value, 16);
    }
    if (this._interactWithCGsMask !== mask) {
      this._interactWithCGsMask = mask;
      this.updateCollisionFilter();
    }
  }

  get ownCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return BitMask.unpack(this._ownCGsMask, 16);
  }

  set ownCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    let mask;
    if (value === 'all') {
      mask = BitMask.full(16);
    } else {
      mask = BitMask.pack(value, 16);
    }
    if (this._ownCGsMask !== mask) {
      this._ownCGsMask = mask;
      this.updateCollisionFilter();
    }
  }

  protected updateCollisionFilter(): void {
    this.nativeBody.collisionFilter = {
      ...this.nativeBody.collisionFilter,
      category: this._ownCGsMask,
      mask: this._interactWithCGsMask,
    };
  }

  clone(): MatterRigidBodyComponent {
    const clonedBody = Body.create({
      ...this.nativeBody,
      collisionFilter: {
        ...this.nativeBody.collisionFilter,
      },
    });
    const component = new MatterRigidBodyComponent(clonedBody, this.shape, this.bodyType, this.ccd);
    component.ownCollisionGroups = this.ownCollisionGroups;
    component.interactWithCollisionGroups = this.interactWithCollisionGroups;
    return component;
  }

  addToWorld(world: MatterGgWorld): void {
    Composite.add(world.physicsWorld.matterWorld!, this.nativeBody);
    world.physicsWorld.added$.next(this);
  }

  removeFromWorld(world: MatterGgWorld, dispose: boolean = false): void {
    Composite.remove(world.physicsWorld.matterWorld!, this.nativeBody);
    world.physicsWorld.removed$.next(this);
    // this body is leaving the world while still touching others - per `onCollisionEnd`'s own
    // contract, each of those bodies sees `null` (no further contact geometry is available), not a
    // dangling reference to a body no longer in the world.
    for (const other of this.currentContacts) {
      other.notifyCollisionEnd(null);
      other.currentContacts.delete(this);
    }
    this.currentContacts.clear();
    if (dispose) {
      this.dispose();
    }
  }

  // matter.js bodies are plain JS objects with no native/WASM handle - ordinary GC reclaims them
  // once `Composite.remove` above drops the engine's own reference, so there's nothing to free
  // beyond completing this component's own RxJS subjects. `MatterTriggerComponent` overrides this
  // to also complete its own `onEnter$`/`onLeft$` subjects, calling back into this via `super.
  // dispose()`.
  dispose(): void {
    this.onCollisionStart$.complete();
    this.onCollisionEnd$.complete();
  }

  resetMotion(): void {
    Body.setVelocity(this.nativeBody, Pnt2.O);
    Body.setAngularVelocity(this.nativeBody, 0);
  }
}
