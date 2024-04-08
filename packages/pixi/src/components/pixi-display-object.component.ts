import {
  Gg2dWorld,
  GgBox2d,
  IDisplayObject2dComponent,
  IEntity,
  PhysicsTypeDocRepo2D,
  Pnt2,
  Point2,
} from '@gg-web-engine/core';
import { PixiSceneComponent } from './pixi-scene.component';
import { PixiVisualTypeDocRepo2D } from '../types';
import { Container } from 'pixi.js';

export class PixiDisplayObjectComponent implements IDisplayObject2dComponent<PixiVisualTypeDocRepo2D> {
  entity: IEntity | null = null;

  constructor(public nativeSprite: Container) {}

  public get position(): Point2 {
    return Pnt2.clone(this.nativeSprite.position);
  }

  public set position(value: Point2) {
    this.nativeSprite.position.x = value.x;
    this.nativeSprite.position.y = value.y;
  }

  public get rotation(): number {
    return this.nativeSprite.rotation;
  }

  public set rotation(value: number) {
    this.nativeSprite.rotation = value;
  }

  public get scale(): Point2 {
    return Pnt2.clone(this.nativeSprite.scale);
  }

  public set scale(value: Point2) {
    this.nativeSprite.scale.x = value.x;
    this.nativeSprite.scale.y = value.y;
  }

  public get visible(): boolean {
    return this.nativeSprite.visible;
  }

  public set visible(value: boolean) {
    this.nativeSprite.visible = value;
  }

  public name: string = '';

  public isEmpty(): boolean {
    return false;
  }

  popChild(name: string): PixiDisplayObjectComponent | null {
    return null;
  }

  getBoundings(): GgBox2d {
    const bounds = this.nativeSprite.boundsArea;
    return {
      min: { x: bounds.x, y: bounds.y },
      max: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    };
  }

  clone(): PixiDisplayObjectComponent {
    return new PixiDisplayObjectComponent(this.nativeSprite);
  }

  addToWorld(world: Gg2dWorld<PixiVisualTypeDocRepo2D, PhysicsTypeDocRepo2D, PixiSceneComponent>): void {
    world.visualScene.nativeContainer?.addChild(this.nativeSprite);
  }

  removeFromWorld(world: Gg2dWorld<PixiVisualTypeDocRepo2D, PhysicsTypeDocRepo2D, PixiSceneComponent>): void {
    world.visualScene.nativeContainer?.removeChild(this.nativeSprite);
  }

  dispose(): void {
    this.nativeSprite.destroy();
  }
}
