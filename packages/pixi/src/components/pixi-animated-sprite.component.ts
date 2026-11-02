import { IAnimatedDisplayObject2dComponent, PlayAnimation2dOptions, Point2, warnOnce } from '@gg-web-engine/core';
import { AnimatedSprite, Ticker } from 'pixi.js';
import { PixiDisplayObjectComponent } from './pixi-display-object.component';
import { PixiVisualTypeDocRepo2D } from '../types';
import { cloneContainer } from '../utils/clone-container';

/** One named clip's frames plus its own playback speed - see `PixiFactory.createAnimatedSprite`. */
export type PixiAnimationClip = {
  frames: AnimatedSprite['textures'];
  /** Playback speed, in frames per second. Default 10. */
  fps?: number;
};

/**
 * A pixi.js `AnimatedSprite`-backed display object carrying a named set of atlas-frame clips (e.g.
 * `idle`/`walk`/`run`/`jump`) - the 2D counterpart of an animated glTF mesh on the 3D side. Built by
 * `PixiFactory.createAnimatedSprite`, never constructed directly.
 *
 * `AnimatedSprite.autoUpdate` is always `false` here - this engine drives every tick itself (see
 * `updateAnimations`), so the sprite is never connected to pixi's own shared `Ticker`. `Ticker.deltaTime`
 * is the only field `AnimatedSprite.update` actually reads, so `updateAnimations(deltaSeconds)`
 * synthesizes a throwaway object with just that field (`deltaSeconds * 60`, matching `deltaTime`'s own
 * "1 == one frame at a 60fps baseline" convention) rather than constructing a real `Ticker`.
 */
export class PixiAnimatedSpriteComponent
  extends PixiDisplayObjectComponent
  implements IAnimatedDisplayObject2dComponent<PixiVisualTypeDocRepo2D>
{
  public readonly animationNames: string[];

  private _currentAnimationName: string | null = null;
  public get currentAnimationName(): string | null {
    return this._currentAnimationName;
  }

  private get animatedSprite(): AnimatedSprite {
    return this.nativeSprite as AnimatedSprite;
  }

  /**
   * @param sprite - The native sprite, its scale the base scale (one over the scene's
   * `pixelsPerMeter`, so a frame's natural size is its texels over that)
   * @param clips - The named clips
   * @param baseScale - The base scale `scale` is relative to, when `sprite`'s own scale already
   * carries a `scale` set on the source (a clone); the sprite's current scale otherwise
   */
  constructor(
    sprite: AnimatedSprite,
    private readonly clips: Record<string, PixiAnimationClip>,
    baseScale?: Point2,
  ) {
    super(sprite, undefined, baseScale);
    this.animationNames = Object.keys(clips);
  }

  playAnimation(name: string, options: PlayAnimation2dOptions = {}): void {
    const clip = this.clips[name];
    if (!clip) {
      warnOnce(
        `[@gg-web-engine/pixi] playAnimation: unknown clip "${name}" - known clips: ${this.animationNames.join(', ')}`,
      );
      return;
    }
    if (this._currentAnimationName === name) {
      return;
    }
    const sprite = this.animatedSprite;
    sprite.textures = clip.frames;
    sprite.loop = options.loop ?? true;
    sprite.animationSpeed = ((clip.fps ?? 10) / 60) * (options.timeScale ?? 1);
    sprite.gotoAndPlay(0);
    this._currentAnimationName = name;
  }

  stopAnimation(): void {
    if (this._currentAnimationName === null) {
      return;
    }
    this.animatedSprite.stop();
    this._currentAnimationName = null;
  }

  updateAnimations(deltaSeconds: number): void {
    if (!this.animatedSprite.playing) {
      return;
    }
    this.animatedSprite.update({ deltaTime: deltaSeconds * 60 } as Ticker);
  }

  clone(): PixiAnimatedSpriteComponent {
    return new PixiAnimatedSpriteComponent(cloneContainer(this.animatedSprite), this.clips, this.baseScale);
  }
}
