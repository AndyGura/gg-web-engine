import {
  CollisionGroup,
  DebugBody2DSettings,
  Entity2d,
  Gg2dWorld,
  IRigidBody2dComponent,
  IVisualScene2dComponent,
  Pnt2,
  Point2,
  Shape2DDescriptor,
  VisualTypeDocRepo2D,
} from '@gg-web-engine/core';
import { Body, Composite, Vector } from 'matter-js';
import { MatterPhysicsTypeDocRepo } from '../types';
import { MatterWorldComponent } from './matter-world.component';

export class MatterRigidBodyComponent implements IRigidBody2dComponent<MatterPhysicsTypeDocRepo> {
  public get position(): Point2 {
    return this.nativeBody.position;
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
    return Pnt2.clone(this.nativeBody.velocity);
  }

  set linearVelocity(value: Point2) {
    Body.setVelocity(this.nativeBody, Vector.create(value.x, value.y));
  }

  get angularVelocity(): number {
    return this.nativeBody.angularVelocity;
  }

  set angularVelocity(value: number) {
    Body.setAngularVelocity(this.nativeBody, value);
  }

  public name: string = '';

  public entity: Entity2d | null = null;

  get debugBodySettings(): DebugBody2DSettings {
    if (isFinite(this.nativeBody.mass)) {
      return { shape: this.shape, type: 'RIGID_DYNAMIC', sleeping: this.nativeBody.isSleeping };
    } else {
      return { shape: this.shape, type: 'RIGID_STATIC' };
    }
  }

  constructor(
    public nativeBody: Body,
    public readonly shape: Shape2DDescriptor,
  ) {}

  get interactWithCollisionGroups(): ReadonlyArray<CollisionGroup> {
    throw new Error('Collision groups not implemented for Matter.js');
  }

  set interactWithCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    throw new Error('Collision groups not implemented for Matter.js');
  }

  get ownCollisionGroups(): ReadonlyArray<CollisionGroup> {
    throw new Error('Collision groups not implemented for Matter.js');
  }

  set ownCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    throw new Error('Collision groups not implemented for Matter.js');
  }

  clone(): MatterRigidBodyComponent {
    // TODO
    throw new Error('Gg2dBody.clone() not implemented for Matter.js');
  }

  addToWorld(
    world: Gg2dWorld<VisualTypeDocRepo2D, MatterPhysicsTypeDocRepo, IVisualScene2dComponent, MatterWorldComponent>,
  ): void {
    Composite.add(world.physicsWorld.matterWorld!, this.nativeBody);
    world.physicsWorld.added$.next(this);
  }

  removeFromWorld(
    world: Gg2dWorld<VisualTypeDocRepo2D, MatterPhysicsTypeDocRepo, IVisualScene2dComponent, MatterWorldComponent>,
  ): void {
    Composite.remove(world.physicsWorld.matterWorld!, this.nativeBody);
    world.physicsWorld.removed$.next(this);
  }

  dispose(): void {}

  resetMotion(): void {
    Body.setVelocity(this.nativeBody, Pnt2.O);
    Body.setAngularVelocity(this.nativeBody, 0);
  }
}
