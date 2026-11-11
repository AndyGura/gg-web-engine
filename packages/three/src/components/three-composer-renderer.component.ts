import { Point2, Renderer3dOptions } from '@gg-web-engine/core';
import { WebGLRendererParameters } from 'three';
import { ThreeSceneComponent } from './three-scene.component';
import { ThreeCameraComponent } from './three-camera.component';
import { ThreeGgWorld } from '../types';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { ThreeBackdrop, ThreeRendererComponent } from './three-renderer.component';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';

/**
 * A `ThreeRendererComponent` drawing through an `EffectComposer` (`nativeComposer`), for
 * post-processing: the world scene is its first `RenderPass`. Backdrops (`Gg3dWorld.backdrops`) get
 * one `RenderPass` each in front of it, farthest first, the first clearing the buffer and every
 * later one (the world scene's included) clearing only depth. The farthest also draws the world's
 * sky, lent by the world scene for the frame. Post-processing passes therefore see the composed
 * color and the world scene's depth only - what depth of field and SSAO want. With `drawBackdrops`
 * off it has no backdrop passes (they are freed, and made again when it is turned back on), and the
 * world pass clears and draws its own sky again.
 */
export class ThreeComposerRendererComponent extends ThreeRendererComponent {
  public readonly nativeComposer: EffectComposer;

  /**
   * The world scene's pass, inserted first in `addToWorld` and taken out in `removeFromWorld`, so a
   * renderer added to a world again has one. Passes an app added after it stay in place.
   */
  protected mainPass: RenderPass | null = null;
  private readonly backdropPasses: Map<ThreeBackdrop, RenderPass> = new Map();
  /** Backdrop passes as they are inserted in `nativeComposer`, in front of `mainPass`. */
  private insertedBackdropPasses: RenderPass[] = [];

  constructor(
    scene: ThreeSceneComponent,
    camera: ThreeCameraComponent,
    canvas?: HTMLCanvasElement,
    rendererOptions: Partial<Renderer3dOptions & WebGLRendererParameters> = {},
  ) {
    super(scene, camera, canvas, rendererOptions);
    this.nativeComposer = new EffectComposer(this.nativeRenderer);
  }

  addToWorld(world: ThreeGgWorld) {
    super.addToWorld(world);
    this.mainPass = new RenderPass(
      this.scene.requireNativeScene('adding a renderer to the world'),
      this.camera.nativeCamera,
    );
    this.nativeComposer.insertPass(this.mainPass, 0);
  }

  removeFromWorld(world: ThreeGgWorld, dispose?: boolean) {
    this.syncBackdropPasses([]);
    if (this.mainPass) {
      this.nativeComposer.removePass(this.mainPass);
      this.mainPass.dispose();
      this.mainPass = null;
    }
    super.removeFromWorld(world, dispose);
  }

  protected override attachBackdrop(backdrop: ThreeBackdrop): void {
    super.attachBackdrop(backdrop);
    const scene = (backdrop.ownedScene as ThreeSceneComponent).nativeScene;
    if (scene && !this.backdropPasses.has(backdrop)) {
      this.backdropPasses.set(backdrop, new RenderPass(scene, backdrop.camera.nativeCamera));
    }
  }

  protected override detachBackdrop(backdrop: ThreeBackdrop): void {
    const pass = this.backdropPasses.get(backdrop);
    if (pass) {
      this.backdropPasses.delete(backdrop);
      // left in `insertedBackdropPasses`, so the next sync sees the change and resets the clear flags
      this.nativeComposer.removePass(pass);
      pass.dispose();
    }
    super.detachBackdrop(backdrop);
  }

  /**
   * Puts the backdrop passes in front of `mainPass` in `backdrops`' order (it changes when a
   * backdrop's `scale` does) and sets which pass clears what. A no-op when the order is unchanged.
   */
  private syncBackdropPasses(backdrops: ReadonlyArray<ThreeBackdrop>): void {
    const wanted = backdrops.map(b => this.backdropPasses.get(b)).filter((p): p is RenderPass => !!p);
    const current = this.insertedBackdropPasses;
    if (wanted.length === current.length && wanted.every((p, i) => p === current[i])) {
      return;
    }
    for (const pass of current) {
      this.nativeComposer.removePass(pass);
    }
    wanted.forEach((pass, i) => {
      this.nativeComposer.insertPass(pass, i);
      pass.clear = i === 0;
      pass.clearDepth = i > 0;
    });
    this.insertedBackdropPasses = wanted;
    if (this.mainPass) {
      this.mainPass.clear = wanted.length === 0;
      this.mainPass.clearDepth = wanted.length > 0;
    }
  }

  resizeRenderer(newSize: Point2): void {
    super.resizeRenderer(newSize);
    this.nativeComposer.setSize(newSize.x, newSize.y);
  }

  /** Sets the pixel ratio of the native renderer and of the composer, whose render targets follow it. */
  setResolution(resolution: number): void {
    super.setResolution(resolution);
    this.nativeComposer.setPixelRatio(resolution);
  }

  render(): void {
    const time = this.world?.worldClock.elapsedTime;
    this.scene.prepareFrame(this.nativeRenderer, time);
    const backdrops = this.backdropsToDraw(this.world);
    this.syncBackdropPasses(backdrops);
    const drawn = backdrops.filter(b => this.backdropPasses.has(b));
    for (const backdrop of drawn) {
      this.poseBackdropCamera(backdrop);
      (backdrop.ownedScene as ThreeSceneComponent).prepareFrame(this.nativeRenderer, time);
    }
    if (drawn.length) {
      this.scene.lendBackgroundTo(drawn[0].ownedScene as ThreeSceneComponent, this.world!.frame.yaw);
    }
    try {
      this.nativeComposer.render();
    } finally {
      this.scene.takeBackgroundBack();
    }
    if (this.physicsDebugViewActive) {
      this.debugView!.render(this.nativeRenderer, this.camera.nativeCamera);
    }
  }

  dispose(): void {
    // render targets first: `super.dispose()` gives up the WebGL context they live in
    this.syncBackdropPasses([]);
    this.nativeComposer.dispose();
    super.dispose();
  }
}
