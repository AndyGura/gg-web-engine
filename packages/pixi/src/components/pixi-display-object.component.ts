import { Gg2dWorld, GgBox2d, IDisplayObject2dComponent, IEntity, Pnt2, Point2 } from '@gg-web-engine/core';
import { PixiSceneComponent } from './pixi-scene.component';
import { DisplayObject } from 'pixi.js';

export class PixiDisplayObjectComponent implements IDisplayObject2dComponent<PixiSceneComponent> {
  entity: IEntity | null = null;

  constructor(public nativeSprite: DisplayObject) {}

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
    const bounds = this.nativeSprite._bounds;
    return {
      min: { x: bounds.minX, y: bounds.minY },
      max: { x: bounds.maxX, y: bounds.maxY },
    };
  }

  clone(): PixiDisplayObjectComponent {
    return new PixiDisplayObjectComponent(this.nativeSprite);
  }

  addToWorld(world: Gg2dWorld<PixiSceneComponent>): void {
    world.visualScene.nativeContainer?.addChild(this.nativeSprite);
  }

  removeFromWorld(world: Gg2dWorld<PixiSceneComponent>): void {
    world.visualScene.nativeContainer?.removeChild(this.nativeSprite);
  }

  dispose(): void {
    this.nativeSprite.destroy();
  }
}
