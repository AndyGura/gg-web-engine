import {
  BitMask,
  Body2DOptions,
  CollisionGroup,
  DebugBody2DSettings,
  Entity2d,
  IRigidBody2dComponent,
  Pnt2,
  Point2,
  Shape2DDescriptor,
} from '@gg-web-engine/core';
import {
  Collider,
  ColliderDesc,
  InteractionGroups,
  RigidBody,
  RigidBodyDesc,
  Vector2,
} from '@dimforge/rapier2d-compat';
import { Rapier2dWorldComponent } from './rapier-2d-world.component';
import { Rapier2dGgWorld, Rapier2dPhysicsTypeDocRepo } from '../types';

export class Rapier2dRigidBodyComponent implements IRigidBody2dComponent<Rapier2dPhysicsTypeDocRepo> {
  public entity: Entity2d | null = null;

  public get position(): Point2 {
    return Pnt2.clone(this.nativeBody ? this.nativeBody.translation() : this._bodyDescr.translation);
  }

  public set position(value: Point2) {
    if (this.nativeBody) {
      this.nativeBody.setTranslation(new Vector2(value.x, value.y), false);
    } else {
      this._bodyDescr.setTranslation(value.x, value.y);
    }
  }

  public get rotation(): number {
    return this.nativeBody ? this.nativeBody.rotation() : this._bodyDescr.rotation;
  }

  public set rotation(value: number) {
    if (this.nativeBody) {
      this.nativeBody.setRotation(value, false);
    } else {
      this._bodyDescr.setRotation(value);
    }
  }

  get linearVelocity(): Point2 {
    return Pnt2.clone(this.nativeBody?.linvel() || Pnt2.O);
  }

  set linearVelocity(value: Point2) {
    if (this.nativeBody) {
      this.nativeBody.setLinvel(new Vector2(value.x, value.y), false);
    }
  }

  get angularVelocity(): number {
    return this.nativeBody?.angvel() || 0;
  }

  set angularVelocity(value: number) {
    if (this.nativeBody) {
      this.nativeBody.setAngvel(value, false);
    }
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

  public get factoryProps(): [
    ColliderDesc[],
    Shape2DDescriptor,
    RigidBodyDesc,
    Omit<Omit<Body2DOptions, 'dynamic'>, 'mass'>,
  ] {
    return [this._colliderDescr, this.shape, this._bodyDescr, this._colliderOptions];
  }

  readonly debugBodySettings: DebugBody2DSettings = new DebugBody2DSettings(
    this._bodyDescr.mass > 0
      ? { type: 'RIGID_DYNAMIC', sleeping: () => !!this._nativeBody?.isSleeping() }
      : { type: 'RIGID_STATIC' },
    this.shape,
  );

  constructor(
    protected readonly world: Rapier2dWorldComponent,
    protected _colliderDescr: ColliderDesc[],
    public readonly shape: Shape2DDescriptor,
    protected _bodyDescr: RigidBodyDesc,
    protected _colliderOptions: Omit<Omit<Body2DOptions, 'dynamic'>, 'mass'>,
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

  clone(): Rapier2dRigidBodyComponent {
    // TODO probably need to clone factory props to not share the same reference?
    return new Rapier2dRigidBodyComponent(this.world, ...this.factoryProps);
  }

  addToWorld(world: Rapier2dGgWorld): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier2D bodies cannot be shared between different worlds');
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

  removeFromWorld(world: Rapier2dGgWorld): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier2D bodies cannot be shared between different worlds');
    }
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
    this._nativeBody!.setAngvel(0, false);
    this._nativeBody!.setLinvel(new Vector2(0, 0), false);
  }

  dispose(): void {
    if (this.nativeBody) {
      this.removeFromWorld({ physicsWorld: this.world } as any as Rapier2dGgWorld);
    }
  }
}
