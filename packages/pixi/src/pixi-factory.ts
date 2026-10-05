import {
  DisplayObject2dOpts,
  IDisplayObject2dComponentFactory,
  ParallaxLayer2dOpts,
  Pnt2,
  Shape2DDescriptor,
  Text2dStyle,
  TextureOptions,
} from '@gg-web-engine/core';
import { PixiDisplayObjectComponent } from './components/pixi-display-object.component';
import { AnimatedSprite, Assets, Container, Graphics, ImageSource, Rectangle, Sprite, Texture } from 'pixi.js';
import type { PixiSceneComponent } from './components/pixi-scene.component';
import { PixiParallaxLayerComponent } from './components/pixi-parallax-layer.component';
import { PixiVisualTypeDocRepo2D } from './types';
import { PixiTextComponent } from './components/pixi-text.component';
import { PixiAnimationClip, PixiAnimatedSpriteComponent } from './components/pixi-animated-sprite.component';

/** A single named clip's location within a uniform-grid atlas - see `PixiGridAtlasOptions`. */
export type PixiGridAtlasClip = {
  /** Row index (0-based) within the grid this clip's frames live on. */
  row: number;
  /** Number of consecutive frames (columns), starting at column 0, this clip uses. */
  frameCount: number;
  /** Playback speed, in frames per second. Default 10. */
  fps?: number;
};

/**
 * Describes a texture atlas laid out as a uniform grid of equally-sized frames (the common case for
 * a hand-authored pixel-art character sheet) - one row per animation clip, `frameCount` consecutive
 * columns per clip starting at column 0. See `PixiFactory.createAnimatedSprite`.
 */
export type PixiGridAtlasOptions = {
  /** Width, in pixels, of a single frame cell. */
  frameWidth: number;
  /** Height, in pixels, of a single frame cell. */
  frameHeight: number;
  /** Named clips, keyed the same way `CharacterAnimation2dClipMap`/`CharacterAnimation2dState` expect
   * (e.g. `idle`/`walk`/`run`/`jump`) - any name is accepted, `IAnimatedDisplayObject2dComponent.animationNames`
   * just reflects whatever keys are given here. */
  clips: Record<string, PixiGridAtlasClip>;
};

export type PixiDisplayObject3dOpts = DisplayObject2dOpts<Texture>;

export class PixiFactory extends IDisplayObject2dComponentFactory<PixiVisualTypeDocRepo2D> {
  /**
   * @param scene - The scene this factory belongs to; `prepare` uploads to its renderers. Without
   * one, `prepare` does nothing.
   */
  constructor(private readonly scene?: PixiSceneComponent) {
    super();
  }

  createPrimitive(descriptor: Shape2DDescriptor, material: PixiDisplayObject3dOpts = {}): PixiDisplayObjectComponent {
    const component = new PixiDisplayObjectComponent(this.createNativePrimitive(descriptor, material), material);
    if (material.opacity !== undefined) {
      component.opacity = material.opacity;
    }
    return component;
  }

  /** Fills an untextured shape's path with `material.color` and outlines it with `material.stroke`. */
  private paint(graphics: Graphics, material: PixiDisplayObject3dOpts): Graphics {
    graphics.fill(material.color ?? this.randomColor());
    if (material.stroke) {
      graphics.stroke({ width: material.stroke.width, color: material.stroke.color });
    }
    return graphics;
  }

  /** A sprite showing `texture`, centered on its position, tinted with `material.color` if set. */
  private texturedSprite(texture: Texture, width: number, height: number, material: PixiDisplayObject3dOpts): Sprite {
    const sprite = new Sprite(texture);
    sprite.width = width;
    sprite.height = height;
    sprite.anchor.x = sprite.anchor.y = 0.5;
    if (material.color !== undefined) {
      sprite.tint = material.color;
    }
    return sprite;
  }

  private createNativePrimitive(descriptor: Shape2DDescriptor, material: PixiDisplayObject3dOpts): Container {
    switch (descriptor.shape) {
      case 'BOX': {
        const { x: width, y: height } = descriptor.dimensions;
        if (material.texture) {
          return this.texturedSprite(material.texture, width, height, material);
        }
        if (material.stroke) {
          return this.paint(new Graphics().rect(-width / 2, -height / 2, width, height), material);
        }
        // a tinted white sprite is cheaper to draw than a Graphics rect
        const sprite = new Sprite(Texture.WHITE);
        sprite.width = width;
        sprite.height = height;
        sprite.tint = material.color ?? this.randomColor();
        sprite.anchor.x = sprite.anchor.y = 0.5;
        return sprite;
      }
      case 'CIRCLE':
        if (material.texture) {
          // assume that texture is circular
          return this.texturedSprite(material.texture, descriptor.radius * 2, descriptor.radius * 2, material);
        }
        return this.paint(new Graphics().circle(0, 0, descriptor.radius), material);
      case 'CAPSULE': {
        const halfDistance = descriptor.centersDistance / 2;
        const radius = descriptor.radius;
        return this.paint(
          new Graphics()
            .moveTo(radius, -halfDistance)
            .lineTo(radius, halfDistance)
            .arc(0, halfDistance, radius, 0, Math.PI)
            .lineTo(-radius, -halfDistance)
            .arc(0, -halfDistance, radius, Math.PI, Math.PI * 2)
            .closePath(),
          material,
        );
      }
      case 'CONVEX_HULL':
        return this.paint(new Graphics().poly(Pnt2.hull(descriptor.vertices).map(v => ({ x: v.x, y: v.y }))), material);
      case 'POLYGON':
        return this.paint(new Graphics().poly(descriptor.vertices.map(v => ({ x: v.x, y: v.y }))), material);
      case 'COMPOUND': {
        const container = new Container();
        // opacity applies once, to the whole compound, not again to each part
        const { opacity, ...partMaterial } = material;
        for (const { position, rotation, shape } of descriptor.children) {
          const submesh = this.createNativePrimitive(shape, partMaterial);
          if (position) {
            submesh.position.set(position.x, position.y);
          }
          if (rotation) {
            submesh.rotation = rotation;
          }
          container.addChild(submesh);
        }
        return container;
      }
    }
  }

  /**
   * Builds an animated sprite from a texture laid out as a uniform grid atlas (see
   * `PixiGridAtlasOptions`) - the entry point for a character sprite with named clips (idle/walk/
   * run/jump, ...). Slices each clip's own row into `frameCount` individual frame textures sharing
   * `baseTexture`'s source (no copying/re-encoding, just distinct `frame` rectangles).
   */
  createAnimatedSprite(baseTexture: Texture, options: PixiGridAtlasOptions): PixiAnimatedSpriteComponent {
    const { frameWidth, frameHeight, clips } = options;
    const clipNames = Object.keys(clips);
    if (clipNames.length === 0) {
      throw new Error('PixiFactory.createAnimatedSprite: `options.clips` must declare at least one clip.');
    }
    const resolvedClips: Record<string, PixiAnimationClip> = {};
    for (const [name, clip] of Object.entries(clips)) {
      const frames: Texture[] = [];
      for (let col = 0; col < clip.frameCount; col++) {
        frames.push(
          new Texture({
            source: baseTexture.source,
            frame: new Rectangle(col * frameWidth, clip.row * frameHeight, frameWidth, frameHeight),
          }),
        );
      }
      resolvedClips[name] = { frames, fps: clip.fps };
    }
    const sprite = new AnimatedSprite(resolvedClips[clipNames[0]].frames, false);
    sprite.anchor.x = sprite.anchor.y = 0.5;
    return new PixiAnimatedSpriteComponent(sprite, resolvedClips);
  }

  createParallaxLayer(options: ParallaxLayer2dOpts<Texture>): PixiParallaxLayerComponent {
    return new PixiParallaxLayerComponent(options);
  }

  async loadTexture(url: string, options: TextureOptions = {}): Promise<Texture> {
    return this.applyTextureOptions(await Assets.load<Texture>(url), options);
  }

  /**
   * Decodes an already-fetched image file into a texture of its own: unlike `loadTexture`, nothing
   * goes through pixi's global `Assets` cache, so the texture belongs to whoever asked for it and
   * is freed with `disposeTexture`.
   */
  async textureFromData(data: Blob, options: TextureOptions = {}): Promise<Texture> {
    const resource = await createImageBitmap(data);
    const source = new ImageSource({ resource, alphaMode: 'premultiply-alpha-on-upload' });
    return this.applyTextureOptions(new Texture({ source }), options);
  }

  /** Frees a texture made by `textureFromData`, together with its image. */
  disposeTexture(texture: Texture): void {
    texture.destroy(true);
  }

  /**
   * Uploads a texture to the GPU on every renderer drawing the scene, instead of on the first
   * frame it is visible in. A renderer that is not initialized yet is skipped.
   */
  async prepare(texture: Texture): Promise<void> {
    for (const renderer of this.scene?.renderers ?? []) {
      (renderer.nativeTextureSystem as { initSource?: (source: unknown) => void } | null)?.initSource?.(texture.source);
    }
  }

  createTextureFromCanvas(canvas: HTMLCanvasElement, options: TextureOptions = {}): Texture {
    return this.applyTextureOptions(Texture.from(canvas), options);
  }

  createText(text: string, style: Text2dStyle = {}): PixiTextComponent {
    return new PixiTextComponent(text, style);
  }

  private applyTextureOptions(texture: Texture, options: TextureOptions): Texture {
    if (options.filter) {
      // a texture source is shared by every texture made from the same image (`Assets` caches by
      // url), so this applies to all of them
      texture.source.scaleMode = options.filter;
    }
    return texture;
  }
}
