import { Entity2d, Gg2dWorld, IRigidBody2dComponent, IVisualScene2dComponent, Pnt2, Point2 } from '@gg-web-engine/core';
import { MatterWorldComponent } from './matter-world.component';
import { Body, Composite, Vector } from 'matter-js';

export class MatterRigidBodyComponent implements IRigidBody2dComponent<MatterWorldComponent> {
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

  constructor(public nativeBody: Body) {}

  clone(): MatterRigidBodyComponent {
    // TODO
    throw new Error('Gg2dBody.clone() not implemented for Matter.js');
  }

  addToWorld(world: Gg2dWorld<IVisualScene2dComponent, MatterWorldComponent>): void {
    Composite.add(world.physicsWorld.matterWorld!, this.nativeBody);
  }

  removeFromWorld(world: Gg2dWorld<IVisualScene2dComponent, MatterWorldComponent>): void {
    Composite.remove(world.physicsWorld.matterWorld!, this.nativeBody);
  }

  dispose(): void {}

  resetMotion(): void {
    Body.setVelocity(this.nativeBody, Pnt2.O);
    Body.setAngularVelocity(this.nativeBody, 0);
  }
}
