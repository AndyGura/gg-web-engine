import { IAnimatedDisplayObject3dComponent, PlayAnimationOptions, warnOnce } from '@gg-web-engine/core';
import { AnimationAction, AnimationClip, AnimationMixer, LoopOnce, LoopRepeat, Object3D } from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ThreeDisplayObjectComponent } from './three-display-object.component';
import { ThreeVisualTypeDocRepo } from '../types';

/**
 * A `ThreeDisplayObjectComponent` whose native mesh carries `AnimationClip`s (loaded via
 * `ThreeLoader.loadFromGlb` from a `.glb` with non-empty `gltf.animations`) - see
 * `IAnimatedDisplayObject3dComponent`'s own doc for the contract this implements. Owns a single
 * `THREE.AnimationMixer` rooted at `nativeMesh` (works whether `nativeMesh` is the loaded model's
 * own scene root, or a wrapping `Group` one level up - see `ThreeLoader.loadFromGlb`'s `offset`
 * handling - since `AnimationMixer`/`AnimationClip` tracks address targets by name via
 * `root.getObjectByName(...)`, found the same way regardless of how many ancestors sit above the
 * named node).
 */
export class ThreeAnimatedDisplayObjectComponent
  extends ThreeDisplayObjectComponent
  implements IAnimatedDisplayObject3dComponent<ThreeVisualTypeDocRepo>
{
  private readonly mixer: AnimationMixer;
  private readonly clips: Map<string, AnimationClip> = new Map();
  private currentAction: AnimationAction | null = null;
  private _currentAnimationName: string | null = null;

  constructor(nativeMesh: Object3D, clips: AnimationClip[]) {
    super(nativeMesh);
    this.mixer = new AnimationMixer(nativeMesh);
    for (const clip of clips) {
      this.clips.set(clip.name, clip);
    }
  }

  public get animationNames(): string[] {
    return [...this.clips.keys()];
  }

  public get currentAnimationName(): string | null {
    return this._currentAnimationName;
  }

  public playAnimation(name: string, options: PlayAnimationOptions = {}): void {
    if (name === this._currentAnimationName) {
      return;
    }
    const clip = this.clips.get(name);
    if (!clip) {
      warnOnce(
        `ThreeAnimatedDisplayObjectComponent.playAnimation: no clip named "${name}" on this model ` +
          `(available: ${this.animationNames.join(', ') || 'none'})`,
      );
      return;
    }
    const { loop = true, fadeDuration = 0.2, timeScale = 1 } = options;
    const nextAction = this.mixer.clipAction(clip);
    nextAction.reset();
    nextAction.setLoop(loop ? LoopRepeat : LoopOnce, Infinity);
    nextAction.clampWhenFinished = !loop;
    nextAction.timeScale = timeScale;
    nextAction.enabled = true;
    nextAction.play();
    if (this.currentAction && this.currentAction !== nextAction) {
      this.currentAction.crossFadeTo(nextAction, fadeDuration, false);
    }
    this.currentAction = nextAction;
    this._currentAnimationName = name;
  }

  public stopAnimation(fadeDuration: number = 0.2): void {
    if (this.currentAction) {
      this.currentAction.fadeOut(fadeDuration);
      this.currentAction = null;
      this._currentAnimationName = null;
    }
  }

  public updateAnimations(deltaSeconds: number): void {
    this.mixer.update(deltaSeconds);
  }

  // `THREE.Object3D.clone()` doesn't correctly rebind a `SkinnedMesh`'s skeleton (bones get cloned
  // but the mesh's own `skeleton.bones` references keep pointing at the *original* bones) -
  // `SkeletonUtils.clone` is three.js's own fix for this, walking the clone and re-binding skinned
  // meshes/skeletons to their cloned counterparts.
  clone(): ThreeAnimatedDisplayObjectComponent {
    return new ThreeAnimatedDisplayObjectComponent(cloneSkeleton(this.nativeMesh), [...this.clips.values()]);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.nativeMesh);
    super.dispose();
  }
}
