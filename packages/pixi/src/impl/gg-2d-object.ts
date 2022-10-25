import { IGg2dObject, Point2 } from '@gg-web-engine/core';
import { Gg2dVisualScene } from './gg-2d-visual-scene';
import { DisplayObject } from 'pixi.js';

export class Gg2dObject implements IGg2dObject {
  constructor(
    public nativeSprite: DisplayObject,
  ) {
  }

  public get position(): Point2 {
    return this.nativeSprite.position;
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
    return this.nativeSprite.scale;
  }

  public set scale(value: Point2) {
    this.nativeSprite.scale.x = value.x;
    this.nativeSprite.scale.y = value.y;
  }

  addToWorld(world: Gg2dVisualScene): void {
    world.nativeContainer?.addChild(this.nativeSprite);
  }

  removeFromWorld(world: Gg2dVisualScene): void {
    world.nativeContainer?.removeChild(this.nativeSprite);
  }

  dispose(): void {
    this.nativeSprite.destroy();
  }

}
