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
import { cloneContainer } from '../utils/clone-container';

/**
 * The `label` pixi.js gives a display object built without an explicit one: its class name (a
 * `new Graphics()` is labelled `"Graphics"`, a `Sprite` `"Sprite"`, ...). Not a name in the
 * engine's sense - `Entity2d` adopts a named display object's name as its own world-unique name, so
 * every unnamed primitive of one kind would collide on it. The component clears it on construction.
 */
const PIXI_DEFAULT_LABELS: ReadonlySet<string> = new Set([
  'Container',
  'Graphics',
  'Sprite',
  'AnimatedSprite',
  'Mesh',
  'TilingSprite',
  'NineSliceSprite',
  'ParticleContainer',
  'RenderContainer',
]);

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

  /**
   * The native scale the object was built with: a sized sprite (a plain or textured `BOX`, a
   * textured `CIRCLE`) gets its size from its native scale. `scale` is relative to it, so
   * `scale = { x: 1, y: 1 }` is always the size the object was created at.
   */
  protected readonly baseScale: Point2;

  constructor(
    public nativeSprite: Container,
    materialOptions?: DisplayObject2dOpts<Texture>,
    baseScale?: Point2,
  ) {
    if (materialOptions) {
      this.materialOptions = materialOptions;
    }
    if (nativeSprite.label && PIXI_DEFAULT_LABELS.has(nativeSprite.label)) {
      nativeSprite.label = '';
    }
    this.baseScale = baseScale ?? Pnt2.clone(nativeSprite.scale);
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
    return { x: this.nativeSprite.scale.x / this.baseScale.x, y: this.nativeSprite.scale.y / this.baseScale.y };
  }

  public set scale(value: Point2) {
    this.nativeSprite.scale.x = value.x * this.baseScale.x;
    this.nativeSprite.scale.y = value.y * this.baseScale.y;
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

  /** the native `Container.label`; `''` while nothing has named this object */
  public get name(): string {
    return this.nativeSprite.label ?? '';
  }

  public set name(value: string) {
    this.nativeSprite.label = value;
  }

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
    const child = this.nativeSprite.children.find(c => c.label === name);
    if (!child) {
      return null;
    }
    this.nativeSprite.removeChild(child);
    return new PixiDisplayObjectComponent(child);
  }

  /** Bounds in world (stage) coordinates, like the 3D adapters' `getBoundings`. */
  getBoundings(): GgBox2d {
    const bounds = this.nativeSprite.getBounds();
    return {
      min: { x: bounds.minX, y: bounds.minY },
      max: { x: bounds.maxX, y: bounds.maxY },
    };
  }

  clone(): PixiDisplayObjectComponent {
    return new PixiDisplayObjectComponent(cloneContainer(this.nativeSprite), this.materialOptions, this.baseScale);
  }

  addToWorld(world: PixiGgWorld): void {
    world.visualScene.requireNativeContainer('adding display objects to the world').addChild(this.nativeSprite);
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
