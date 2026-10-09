import {
  Environment3dOpts,
  IVisualScene3dComponent,
  MAIN_RENDER_LAYER,
  RenderLayer,
  RendererOptions,
  SELF_VIEW_HIDDEN_RENDER_LAYER,
} from '@gg-web-engine/core';
import { Color, Fog, FogExp2, Scene, Texture, WebGLRendererParameters } from 'three';
import { ThreeFactory } from '../three-factory';
import { ThreeLoader } from '../three-loader';
import { ThreeCameraComponent } from './three-camera.component';
import { ThreeRendererComponent } from './three-renderer.component';
import { ThreeVisualTypeDocRepo } from '../types';
import { ThreeComposerRendererComponent } from './three-composer-renderer.component';

/**
 * The three.js visual scene of a `Gg3dWorld`: pass a new one as `visualScene`. Its `factory`
 * creates meshes, cameras and lights, its `loader` textures and models; the three.js `Scene` itself
 * is `nativeScene` once the world is initialized. Native three.js primitives are Y-up, but every
 * shape, camera and sky this adapter creates is re-oriented to the engine's Z-up world.
 *
 * @example
 * ```ts
 * import { Gg3dWorld } from '@gg-web-engine/core';
 * import { ThreeGgWorld, ThreeSceneComponent } from '@gg-web-engine/three';
 *
 * const world: ThreeGgWorld = new Gg3dWorld({ visualScene: new ThreeSceneComponent() }); // rendering only
 * await world.init();
 * world.visualScene.setEnvironment({ background: 0x88bbee });
 * world.addLight({ type: 'HEMISPHERE', intensity: 2 });
 * const scene = world.visualScene.nativeScene!; // the THREE.Scene, for what the engine doesn't wrap
 * ```
 */
export class ThreeSceneComponent implements IVisualScene3dComponent<ThreeVisualTypeDocRepo> {
  public readonly backendName: string = 'three';

  private _nativeScene: Scene | null = null;
  public get nativeScene(): Scene | null {
    return this._nativeScene;
  }

  public readonly factory: ThreeFactory = new ThreeFactory();
  public readonly loader: ThreeLoader = new ThreeLoader(this);

  /** The renderers currently drawing this scene - what `ThreeLoader.prepare` uploads to. */
  public readonly renderers: Set<ThreeRendererComponent> = new Set();

  public readonly mainRenderLayer: RenderLayer = MAIN_RENDER_LAYER;

  async init(): Promise<void> {
    this._nativeScene = new Scene();
    this.applyEnvironment();
  }

  private _environment: Environment3dOpts<Texture> = { background: null, environmentMap: null, fog: null };
  public get environment(): Readonly<Environment3dOpts<Texture>> {
    return this._environment;
  }

  setEnvironment(environment: Partial<Environment3dOpts<Texture>>): void {
    this._environment = { ...this._environment, ...environment };
    this.applyEnvironment();
  }

  /**
   * three.js samples sky textures Y-up - an equirectangular panorama's top edge and a cube map's
   * `py` slot are both towards `+Y` - so they're turned a quarter around X to put that overhead in
   * the engine's Z-up world (`ThreeLoader.loadCubeTexture` fills the cube slots to match).
   */
  private static zUpRotationX(texture: Texture | null): number {
    return texture ? Math.PI / 2 : 0;
  }

  private applyEnvironment(): void {
    const scene = this._nativeScene;
    if (!scene) {
      return;
    }
    const { background, environmentMap, fog } = this._environment;
    if (typeof background === 'number') {
      scene.background = new Color(background);
      scene.backgroundRotation.set(0, 0, 0);
    } else {
      scene.background = background;
      scene.backgroundRotation.set(ThreeSceneComponent.zUpRotationX(background), 0, 0);
    }
    scene.environment = environmentMap;
    scene.environmentRotation.set(ThreeSceneComponent.zUpRotationX(environmentMap), 0, 0);
    if (!fog) {
      scene.fog = null;
    } else if (fog.type === 'LINEAR') {
      scene.fog = new Fog(fog.color, fog.near, fog.far);
    } else {
      scene.fog = new FogExp2(fog.color, fog.density);
    }
  }

  // Mirrors `AmmoWorldComponent.lockedCollisionGroups`/`registerCollisionGroup` exactly - see that
  // method's own doc. Three.js layers only go up to index 31 (a 32-bit mask); `31` itself
  // (`SELF_VIEW_HIDDEN_RENDER_LAYER`) is permanently excluded from this range rather than tracked in
  // `lockedRenderLayers` - it's reserved engine-wide, not something this one scene instance could
  // ever "free" by deregistering it.
  protected lockedRenderLayers: RenderLayer[] = [];

  registerRenderLayer(): RenderLayer {
    for (let i = 1; i < SELF_VIEW_HIDDEN_RENDER_LAYER; i++) {
      if (!this.lockedRenderLayers.includes(i)) {
        this.lockedRenderLayers.push(i);
        return i;
      }
    }
    throw new Error(
      `App tries to register too many render layers, three.js supports only ${SELF_VIEW_HIDDEN_RENDER_LAYER - 1}`,
    );
  }

  deregisterRenderLayer(layer: RenderLayer): void {
    this.lockedRenderLayers = this.lockedRenderLayers.filter(x => x !== layer);
  }

  createRenderer(
    camera: ThreeCameraComponent,
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & WebGLRendererParameters>,
  ): ThreeRendererComponent {
    return new ThreeRendererComponent(this, camera, canvas, rendererOptions);
  }

  createComposerRenderer(
    camera: ThreeCameraComponent,
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & WebGLRendererParameters>,
  ): ThreeComposerRendererComponent {
    return new ThreeComposerRendererComponent(this, camera, canvas, rendererOptions);
  }

  dispose(): void {
    this._nativeScene = new Scene();
    this._environment = { background: null, environmentMap: null, fog: null };
  }
}
