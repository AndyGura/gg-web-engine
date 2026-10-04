import {
  DisplayObject2dOpts,
  IDisplayObject2dComponentFactory,
  ParallaxLayer2dOpts,
  Pnt2,
  Shape2DDescriptor,
} from '@gg-web-engine/core';
import { PixiDisplayObjectComponent } from './components/pixi-display-object.component';
import { AnimatedSprite, Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { PixiParallaxLayerComponent } from './components/pixi-parallax-layer.component';
import { PixiVisualTypeDocRepo2D } from './types';
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
  createPrimitive(descriptor: Shape2DDescriptor, material: PixiDisplayObject3dOpts = {}): PixiDisplayObjectComponent {
    switch (descriptor.shape) {
      case 'BOX':
        const sprite = new Sprite(material.texture || Texture.WHITE);
        sprite.width = descriptor.dimensions.x;
        sprite.height = descriptor.dimensions.y;
        if (!material.texture) {
          sprite.tint = material.color || this.randomColor();
        }
        sprite.anchor.x = sprite.anchor.y = 0.5;
        return new PixiDisplayObjectComponent(sprite, material);
      case 'CIRCLE':
        if (material.texture) {
          // assume that texture is circular
          const sprite = new Sprite(material.texture);
          sprite.width = sprite.height = descriptor.radius * 2;
          sprite.anchor.x = sprite.anchor.y = 0.5;
          return new PixiDisplayObjectComponent(sprite, material);
        }
        return new PixiDisplayObjectComponent(
          new Graphics().circle(0, 0, descriptor.radius).fill(material.color || this.randomColor()),
          material,
        );
      case 'CAPSULE': {
        const halfDistance = descriptor.centersDistance / 2;
        const radius = descriptor.radius;
        const graphics = new Graphics()
          .moveTo(radius, -halfDistance)
          .lineTo(radius, halfDistance)
          .arc(0, halfDistance, radius, 0, Math.PI)
          .lineTo(-radius, -halfDistance)
          .arc(0, -halfDistance, radius, Math.PI, Math.PI * 2)
          .fill(material.color || this.randomColor());
        return new PixiDisplayObjectComponent(graphics, material);
      }
      case 'CONVEX_HULL': {
        const graphics = new Graphics()
          .poly(Pnt2.hull(descriptor.vertices).map(v => ({ x: v.x, y: v.y })))
          .fill(material.color || this.randomColor());
        return new PixiDisplayObjectComponent(graphics, material);
      }
      case 'POLYGON': {
        const graphics = new Graphics()
          .poly(descriptor.vertices.map(v => ({ x: v.x, y: v.y })))
          .fill(material.color || this.randomColor());
        return new PixiDisplayObjectComponent(graphics, material);
      }
      case 'COMPOUND': {
        const container = new Container();
        for (const { position, rotation, shape } of descriptor.children) {
          const submesh = this.createPrimitive(shape, material).nativeSprite;
          if (position) {
            submesh.position.set(position.x, position.y);
          }
          if (rotation) {
            submesh.rotation = rotation;
          }
          container.addChild(submesh);
        }
        return new PixiDisplayObjectComponent(container, material);
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

  loadTexture(url: string): Promise<Texture> {
    return Assets.load<Texture>(url);
  }
}
