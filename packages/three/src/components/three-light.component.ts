import {
  ILight3dComponent,
  Light3dDescriptor,
  Light3dShadowOpts,
  Light3dType,
  Pnt3,
  Point3,
  Point4,
} from '@gg-web-engine/core';
import {
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  Light,
  LightShadow,
  OrthographicCamera,
  PerspectiveCamera,
  PointLight,
  SpotLight,
} from 'three';
import { ThreeDisplayObjectComponent } from './three-display-object.component';
import { ThreeVisualTypeDocRepo } from '../types';

/**
 * three.js implementation of `ILight3dComponent`. `nativeLight` is the underlying `THREE.Light`.
 *
 * Directional and spot lights get their `target` as a child placed one unit along local `-Z`, so
 * they shine wherever the component's rotation points them (three.js otherwise aims them at a
 * separate target object sitting at the world origin). A hemisphere light takes its sky direction
 * from its own position in three.js, so for that type the position setter is ignored and the
 * native position is kept at the rotated `+Z` unit vector instead.
 */
export class ThreeLightComponent
  extends ThreeDisplayObjectComponent
  implements ILight3dComponent<ThreeVisualTypeDocRepo>
{
  static create(descriptor: Light3dDescriptor): ThreeLightComponent {
    let light: Light;
    switch (descriptor.type) {
      case 'AMBIENT':
        light = new AmbientLight(descriptor.color ?? 0xffffff, descriptor.intensity ?? 1);
        break;
      case 'HEMISPHERE':
        light = new HemisphereLight(
          descriptor.color ?? 0xffffff,
          descriptor.groundColor ?? 0x444444,
          descriptor.intensity ?? 1,
        );
        break;
      case 'DIRECTIONAL':
        light = new DirectionalLight(descriptor.color ?? 0xffffff, descriptor.intensity ?? 1);
        break;
      case 'POINT':
        light = new PointLight(
          descriptor.color ?? 0xffffff,
          descriptor.intensity ?? 1,
          descriptor.distance ?? 0,
          descriptor.decay ?? 2,
        );
        break;
      case 'SPOT':
        light = new SpotLight(
          descriptor.color ?? 0xffffff,
          descriptor.intensity ?? 1,
          descriptor.distance ?? 0,
          descriptor.angle ?? Math.PI / 3,
          descriptor.penumbra ?? 0,
          descriptor.decay ?? 2,
        );
        break;
      default:
        throw new Error(`Light type "${(descriptor as any).type}" not implemented for three.js`);
    }
    return new ThreeLightComponent(light, descriptor);
  }

  public readonly lightType: Light3dType;
  private readonly shadowOpts: Light3dShadowOpts | undefined;

  constructor(
    public readonly nativeLight: Light,
    descriptor: Light3dDescriptor,
  ) {
    super(nativeLight);
    this.lightType = descriptor.type;
    // three.js places directional/spot/hemisphere lights at (0, 1, 0) by default; the engine
    // positions everything explicitly
    nativeLight.position.set(0, 0, 0);
    if (nativeLight instanceof DirectionalLight || nativeLight instanceof SpotLight) {
      nativeLight.target.position.set(0, 0, -1);
      nativeLight.add(nativeLight.target);
    }
    if (nativeLight instanceof HemisphereLight) {
      nativeLight.position.set(0, 0, 1);
    }
    const shadow = this.nativeShadow;
    if (shadow) {
      const { castShadow, shadow: shadowOpts } = descriptor as { castShadow?: boolean; shadow?: Light3dShadowOpts };
      this.shadowOpts = shadowOpts;
      ThreeLightComponent.applyShadowOpts(shadow, shadowOpts || {});
      nativeLight.castShadow = !!castShadow;
    }
  }

  private static applyShadowOpts(shadow: LightShadow, opts: Light3dShadowOpts): void {
    if (opts.mapSize !== undefined) {
      shadow.mapSize.set(opts.mapSize, opts.mapSize);
    }
    if (opts.bias !== undefined) {
      shadow.bias = opts.bias;
    }
    if (opts.normalBias !== undefined) {
      shadow.normalBias = opts.normalBias;
    }
    const camera = shadow.camera as OrthographicCamera | PerspectiveCamera;
    if (opts.near !== undefined) {
      camera.near = opts.near;
    }
    if (opts.far !== undefined) {
      camera.far = opts.far;
    }
    if (opts.area !== undefined && camera instanceof OrthographicCamera) {
      camera.left = -opts.area;
      camera.right = opts.area;
      camera.top = opts.area;
      camera.bottom = -opts.area;
    }
    camera.updateProjectionMatrix();
  }

  private _hemispherePosition: Point3 = Pnt3.O;

  public get position(): Point3 {
    if (this.lightType === 'HEMISPHERE') {
      return this._hemispherePosition;
    }
    return super.position;
  }

  public set position(value: Point3) {
    if (this.lightType === 'HEMISPHERE') {
      this._hemispherePosition = value;
      return;
    }
    super.position = value;
  }

  public get rotation(): Point4 {
    return super.rotation;
  }

  public set rotation(value: Point4) {
    super.rotation = value;
    if (this.lightType === 'HEMISPHERE') {
      const up = Pnt3.rot(Pnt3.Z, value);
      this.nativeLight.position.set(up.x, up.y, up.z);
    }
  }

  public get color(): number {
    return this.nativeLight.color.getHex();
  }

  public set color(value: number) {
    this.nativeLight.color.setHex(value);
  }

  public get intensity(): number {
    return this.nativeLight.intensity;
  }

  public set intensity(value: number) {
    this.nativeLight.intensity = value;
  }

  /** The native shadow settings, for the light types that can cast shadows. */
  public get nativeShadow(): LightShadow | undefined {
    return (this.nativeLight as Light & { shadow?: LightShadow }).shadow;
  }

  public get castShadow(): boolean {
    return !!this.nativeShadow && this.nativeLight.castShadow;
  }

  public set castShadow(value: boolean) {
    if (this.nativeShadow) {
      this.nativeLight.castShadow = value;
    }
  }

  public get lightOptions(): Light3dDescriptor {
    const color = this.color;
    const intensity = this.intensity;
    const shadow = this.shadowOpts ? { shadow: { ...this.shadowOpts } } : {};
    const light = this.nativeLight;
    switch (this.lightType) {
      case 'AMBIENT':
        return { type: 'AMBIENT', color, intensity };
      case 'HEMISPHERE':
        return { type: 'HEMISPHERE', color, intensity, groundColor: (light as HemisphereLight).groundColor.getHex() };
      case 'DIRECTIONAL':
        return { type: 'DIRECTIONAL', color, intensity, castShadow: this.castShadow, ...shadow };
      case 'POINT': {
        const point = light as PointLight;
        return {
          type: 'POINT',
          color,
          intensity,
          distance: point.distance,
          decay: point.decay,
          castShadow: this.castShadow,
          ...shadow,
        };
      }
      case 'SPOT': {
        const spot = light as SpotLight;
        return {
          type: 'SPOT',
          color,
          intensity,
          distance: spot.distance,
          decay: spot.decay,
          angle: spot.angle,
          penumbra: spot.penumbra,
          castShadow: this.castShadow,
          ...shadow,
        };
      }
    }
  }

  clone(): ThreeLightComponent {
    const clone = ThreeLightComponent.create(this.lightOptions);
    clone.position = this.position;
    clone.rotation = this.rotation;
    clone.nativeLight.layers.mask = this.nativeLight.layers.mask;
    return clone;
  }

  dispose(): void {
    this.nativeLight.dispose();
  }
}
