import {
  BitMask,
  CollisionGroup,
  DebugBody2DSettings,
  Entity2d,
  IRigidBody2dComponent,
  Pnt2,
  Point2,
  Shape2DDescriptor,
} from '@gg-web-engine/core';
import { Body, Composite, Vector } from 'matter-js';
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

  readonly debugBodySettings: DebugBody2DSettings = new DebugBody2DSettings(
    isFinite(this.nativeBody.mass)
      ? { type: 'RIGID_DYNAMIC', sleeping: () => this.nativeBody.isSleeping }
      : { type: 'RIGID_STATIC' },
    this.shape,
  );

  protected _interactWithCGsMask = BitMask.full(16);
  protected _ownCGsMask = BitMask.full(16);

  constructor(
    public nativeBody: Body,
    public readonly shape: Shape2DDescriptor,
  ) {
    this.updateCollisionFilter();
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
    const component = new MatterRigidBodyComponent(clonedBody, this.shape);
    component.ownCollisionGroups = this.ownCollisionGroups;
    component.interactWithCollisionGroups = this.interactWithCollisionGroups;
    return component;
  }

  addToWorld(world: MatterGgWorld): void {
    Composite.add(world.physicsWorld.matterWorld!, this.nativeBody);
    world.physicsWorld.added$.next(this);
  }

  removeFromWorld(world: MatterGgWorld): void {
    Composite.remove(world.physicsWorld.matterWorld!, this.nativeBody);
    world.physicsWorld.removed$.next(this);
  }

  dispose(): void {}

  resetMotion(): void {
    Body.setVelocity(this.nativeBody, Pnt2.O);
    Body.setAngularVelocity(this.nativeBody, 0);
  }
}
