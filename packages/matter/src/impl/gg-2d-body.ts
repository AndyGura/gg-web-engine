import { IGg2dBody, Point2, Gg2dEntity } from '@gg-web-engine/core';
import { Gg2dPhysicsWorld } from './gg-2d-physics-world';
import { Body, Composite, Vector } from 'matter-js';

export class Gg2dBody implements IGg2dBody {
  public get position(): Point2 {
    return this.nativeBody.position;
  }

  public set position(value: Point2) {
    Body.translate(this.nativeBody, Vector.create(value.x, value.y));
  }

  public get rotation(): number {
    return this.nativeBody.angle;
  }

  public set rotation(value: number) {
    this.nativeBody.angle = value;
  }

  public get scale(): Point2 {
    // hmm, is it even possible to be different?
    return { x: 1, y: 1 };
  }

  public name: string = '';

  public entity: Gg2dEntity | null = null;

  constructor(public nativeBody: Body) {}

  clone(): Gg2dBody {
    // TODO
    throw new Error('Gg2dBody.clone() not implemented for Matter.js');
  }

  addToWorld(world: Gg2dPhysicsWorld): void {
    Composite.add(world.matterWorld!, this.nativeBody);
  }

  removeFromWorld(world: Gg2dPhysicsWorld): void {
    Composite.remove(world.matterWorld!, this.nativeBody);
  }

  dispose(): void {}

  resetMotion(): void {
    Body.setVelocity(this.nativeBody, { x: 0, y: 0 });
    Body.setAngularVelocity(this.nativeBody, 0);
  }
}
