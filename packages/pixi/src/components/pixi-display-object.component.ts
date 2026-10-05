import {
  DisplayObject2dOpts,
  GgBox2d,
  IDisplayObject2dComponent,
  IEntity,
  IMaterialReadable2dComponent,
  Pnt2,
  Point2,
} from '@gg-web-engine/core';
import { PixiGgWorld, PixiVisualTypeDocRepo2D } from '../types';
import { Container, Texture } from 'pixi.js';

export class PixiDisplayObjectComponent
  implements
    IDisplayObject2dComponent<PixiVisualTypeDocRepo2D>,
    Partial<IMaterialReadable2dComponent<PixiVisualTypeDocRepo2D>>
{
  entity: IEntity | null = null;

  /**
   * The options this display object was actually built with, when constructed via
   * `PixiFactory.createPrimitive` - see `IMaterialReadable2dComponent`'s own doc. Left unset for a
   * sprite built any other way (e.g. `PixiFactory.createAnimatedSprite`), which is why this is
   * `Partial` rather than a hard implementation of that interface - check with
   * `isMaterialReadable2d` before relying on it.
   */
  public readonly materialOptions?: DisplayObject2dOpts<Texture>;

  constructor(
    public nativeSprite: Container,
    materialOptions?: DisplayObject2dOpts<Texture>,
  ) {
    if (materialOptions) {
      this.materialOptions = materialOptions;
    }
  }

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

  public get zIndex(): number {
    return this.nativeSprite.zIndex;
  }

  public set zIndex(value: number) {
    this.nativeSprite.zIndex = value;
  }

  public get tint(): number {
    return this.nativeSprite.tint;
  }

  public set tint(value: number) {
    this.nativeSprite.tint = value;
  }

  public get opacity(): number {
    return this.nativeSprite.alpha;
  }

  public set opacity(value: number) {
    this.nativeSprite.alpha = value;
  }

  public name: string = '';

  public addChild(child: PixiDisplayObjectComponent): void {
    // `Container.addChild` already detaches the child from any previous parent
    this.nativeSprite.addChild(child.nativeSprite);
  }

  public removeChild(child: PixiDisplayObjectComponent): void {
    if (child.nativeSprite.parent === this.nativeSprite) {
      this.nativeSprite.removeChild(child.nativeSprite);
    }
  }

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

  addToWorld(world: PixiGgWorld): void {
    world.visualScene.nativeContainer?.addChild(this.nativeSprite);
  }

  removeFromWorld(world: PixiGgWorld, dispose?: boolean): void {
    world.visualScene.nativeContainer?.removeChild(this.nativeSprite);
    if (dispose) {
      this.dispose();
    }
  }

  dispose(): void {
    // children added with `addChild` are disposed together with their parent
    this.nativeSprite.destroy({ children: true });
  }
}
