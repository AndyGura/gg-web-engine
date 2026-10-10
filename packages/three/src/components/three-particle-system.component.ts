import {
  IParticleSystem3dComponent,
  ParticleBlendMode,
  ParticleRenderBuffers,
  ParticleSystem3dRenderOptions,
  sortParticlesBackToFront,
} from '@gg-web-engine/core';
import {
  AdditiveBlending,
  Blending,
  BufferAttribute,
  Camera,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Material,
  Matrix4,
  Mesh,
  MultiplyBlending,
  NormalBlending,
  ShaderMaterial,
  SubtractiveBlending,
  Texture,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from 'three';
import { ThreeDisplayObjectComponent } from './three-display-object.component';
import { ThreeGgWorld, ThreeVisualTypeDocRepo } from '../types';

/**
 * three.js-only particle system options, merged into `ParticleSystem3dRenderOptions` when creating a
 * system (`factory.createParticleSystem` / `world.addParticleSystem`).
 */
export type ThreeParticleSystemExtraOpts = {
  /**
   * Replaces or adjusts the material the particles are drawn with: receives the built-in
   * `ShaderMaterial`, already set up from the render options, and returns the material to use - the
   * same one changed (e.g. `blending = CustomBlending` with the app's own `blendSrc`/`blendDst`/
   * `blendEquation`, a different `fragmentShader` reusing `THREE_PARTICLE_VERTEX_SHADER`), or a new
   * one. A custom shader reads the attributes described on `ThreeParticleSystemComponent`. The
   * built-in material is disposed if another one is returned; the returned one is disposed with the
   * system.
   */
  material?: (defaultMaterial: ShaderMaterial) => Material;
};

/**
 * The built-in particle vertex shader: expands each instance of the unit quad (`position.xy` in
 * `-0.5..0.5`, `uv` in `0..1`) into a sprite of `particleSize` world units around `particleCenter`,
 * rotated by `particleRotation` in its own plane and facing the camera (or, with the
 * `GG_BILLBOARD_VERTICAL` define, turning around world `Z` only). Passes `vUv` (the atlas region,
 * `particleUv`, flipped for the texture's `flipY` through the `uFlipY` uniform), `vColor`
 * (`particleColor`: sRGB tint and opacity) and `vExtra` (`particleExtra`) on, and supports fog.
 */
export const THREE_PARTICLE_VERTEX_SHADER = /* glsl */ `
#include <fog_pars_vertex>
attribute vec3 particleCenter;
attribute vec2 particleSize;
attribute float particleRotation;
attribute vec4 particleColor;
attribute vec4 particleUv;
attribute vec4 particleExtra;
uniform float uFlipY;
varying vec2 vUv;
varying vec4 vColor;
varying vec4 vExtra;
void main() {
  vec2 corner = position.xy * particleSize;
  float c = cos(particleRotation);
  float s = sin(particleRotation);
  corner = vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y);
#ifdef GG_BILLBOARD_VERTICAL
  vec3 worldCenter = (modelMatrix * vec4(particleCenter, 1.0)).xyz;
  vec2 toCamera = cameraPosition.xy - worldCenter.xy;
  float toCameraLength = length(toCamera);
  vec3 right = toCameraLength > 1e-6 ? vec3(-toCamera.y, toCamera.x, 0.0) / toCameraLength : vec3(1.0, 0.0, 0.0);
  vec4 mvPosition = viewMatrix * vec4(worldCenter + right * corner.x + vec3(0.0, 0.0, corner.y), 1.0);
#else
  vec4 mvPosition = modelViewMatrix * vec4(particleCenter, 1.0);
  mvPosition.xy += corner;
#endif
  gl_Position = projectionMatrix * mvPosition;
  // particleUv is in image coordinates (top-left origin, y down); the quad's top edge is uv.y = 1
  vec2 imageUv = vec2(particleUv.x + uv.x * particleUv.z, particleUv.y + (1.0 - uv.y) * particleUv.w);
  vUv = vec2(imageUv.x, uFlipY > 0.5 ? 1.0 - imageUv.y : imageUv.y);
  vColor = particleColor;
  vExtra = particleExtra;
#include <fog_vertex>
}
`;

/**
 * The built-in particle fragment shader: texture (`GG_USE_MAP`) times tint, alpha from the texture
 * (or, with `GG_TEXTURE_ALPHA_BRIGHTNESS`, its brightest channel as stored in the image, i.e. in
 * the output color space) times opacity, `uAlphaTest`
 * discard, tone mapping, output color space and fog (faded out instead of mixed towards the fog
 * color with `GG_FOG_FADE`, for blend modes that add or darken), and premultiplied output - by the
 * alpha, or by the opacity alone with `GG_PREMULTIPLIED_INPUT`.
 */
export const THREE_PARTICLE_FRAGMENT_SHADER = /* glsl */ `
#include <fog_pars_fragment>
#ifdef GG_USE_MAP
uniform sampler2D map;
#endif
uniform float uAlphaTest;
varying vec2 vUv;
varying vec4 vColor;
varying vec4 vExtra;
void main() {
#ifdef GG_USE_MAP
  vec4 texel = texture2D(map, vUv);
#else
  vec4 texel = vec4(1.0);
#endif
#ifdef GG_TEXTURE_ALPHA_BRIGHTNESS
  // brightness as stored in the image (output color space), not of the linearized texel
  vec3 imageColor = linearToOutputTexel(vec4(texel.rgb, 1.0)).rgb;
  float textureAlpha = max(imageColor.r, max(imageColor.g, imageColor.b)) * texel.a;
#else
  float textureAlpha = texel.a;
#endif
  vec3 color = texel.rgb * sRGBTransferEOTF(vec4(vColor.rgb, 1.0)).rgb;
  float opacity = vColor.a;
#ifdef USE_FOG
  #ifdef FOG_EXP2
  float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  #else
  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  #ifdef GG_FOG_FADE
  opacity *= 1.0 - fogFactor;
  #endif
#endif
  float alpha = textureAlpha * opacity;
  if (alpha <= uAlphaTest) discard;
  gl_FragColor = vec4(color, alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#if defined(USE_FOG) && !defined(GG_FOG_FADE)
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
#endif
#ifdef GG_PREMULTIPLIED_INPUT
  gl_FragColor.rgb *= opacity;
#else
  gl_FragColor.rgb *= alpha;
#endif
}
`;

const BLENDING: Record<ParticleBlendMode, Blending> = {
  normal: NormalBlending,
  additive: AdditiveBlending,
  multiply: MultiplyBlending,
  subtractive: SubtractiveBlending,
  premultiplied: NormalBlending,
};

/**
 * The built-in particle material for `options`: a `ShaderMaterial` with the shaders above, the
 * blend mode as three.js blending with `premultipliedAlpha` (the shader outputs premultiplied
 * color), `transparent`, depth test/write and fog from the options.
 */
export function createThreeParticleMaterial(options: ParticleSystem3dRenderOptions<Texture>): ShaderMaterial {
  const blending = options.blending ?? 'normal';
  const defines: Record<string, string> = {};
  if (options.texture) {
    defines.GG_USE_MAP = '';
  }
  if (options.billboard === 'vertical') {
    defines.GG_BILLBOARD_VERTICAL = '';
  }
  if (options.textureAlpha === 'brightness') {
    defines.GG_TEXTURE_ALPHA_BRIGHTNESS = '';
  }
  if (blending === 'premultiplied') {
    defines.GG_PREMULTIPLIED_INPUT = '';
  }
  if (blending === 'additive' || blending === 'multiply' || blending === 'subtractive') {
    defines.GG_FOG_FADE = '';
  }
  return new ShaderMaterial({
    name: 'GgParticleMaterial',
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      { map: { value: options.texture ?? null }, uFlipY: { value: 1 }, uAlphaTest: { value: options.alphaTest ?? 0 } },
    ]),
    defines,
    vertexShader: THREE_PARTICLE_VERTEX_SHADER,
    fragmentShader: THREE_PARTICLE_FRAGMENT_SHADER,
    blending: BLENDING[blending],
    premultipliedAlpha: true,
    transparent: true,
    depthTest: options.depthTest ?? true,
    depthWrite: options.depthWrite ?? false,
    fog: options.fog ?? true,
  });
}

/** Quad corners, two triangles, counter-clockwise from the front. */
const QUAD_POSITIONS = new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
const QUAD_UVS = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
const QUAD_INDEX = [0, 1, 2, 0, 2, 3];

/**
 * The three.js `IParticleSystem3dComponent`: one `Mesh` of an `InstancedBufferGeometry` - a unit
 * quad drawn once per particle in a single draw call. Per-instance attributes, filled from core's
 * `ParticleRenderBuffers` right before each camera renders the scene (sorted back to front for that
 * camera unless `sort: false`):
 * - `particleCenter` (vec3), `particleSize` (vec2, world units), `particleRotation` (float, radians),
 * - `particleColor` (vec4: sRGB tint and opacity), `particleUv` (vec4: atlas region `x, y, width,
 *   height`, top-left origin), `particleExtra` (vec4: `Particle.shaderData`).
 *
 * The mesh is never frustum-culled, casts no shadows and is ignored by three.js raycasting. Sorting
 * runs in the scene's `onBeforeRender` (see `ThreeSceneComponent.beforeRenderHooks`): an app must
 * not replace `nativeScene.onBeforeRender`.
 */
export class ThreeParticleSystemComponent
  extends ThreeDisplayObjectComponent
  implements IParticleSystem3dComponent<ThreeVisualTypeDocRepo>
{
  public readonly capacity: number;
  public readonly nativeGeometry: InstancedBufferGeometry;
  public readonly nativeMaterial: Material;
  declare public nativeMesh: Mesh<InstancedBufferGeometry, Material>;

  private readonly _renderOptions: ParticleSystem3dRenderOptions<Texture> & ThreeParticleSystemExtraOpts;
  public get renderOptions(): Readonly<ParticleSystem3dRenderOptions<Texture>> {
    return this._renderOptions;
  }

  private readonly attributes: {
    center: InstancedBufferAttribute;
    size: InstancedBufferAttribute;
    rotation: InstancedBufferAttribute;
    color: InstancedBufferAttribute;
    uv: InstancedBufferAttribute;
    extra: InstancedBufferAttribute;
  };
  private buffers: ParticleRenderBuffers | null = null;
  /** whether `buffers` changed since the attributes were last filled */
  private dirty = false;
  private readonly sortIndices: Uint32Array;
  private readonly sortDepths: Float32Array;
  private world: ThreeGgWorld | null = null;
  private readonly inverseMatrix = new Matrix4();
  private readonly cameraPosition = new Vector3();
  private readonly cameraDirection = new Vector3();

  constructor(options: ParticleSystem3dRenderOptions<Texture> & ThreeParticleSystemExtraOpts) {
    const capacity = options.capacity;
    if (!(capacity > 0) || !Number.isInteger(capacity)) {
      throw new Error(`Particle system capacity must be a positive integer, got ${capacity}`);
    }
    const geometry = new InstancedBufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(QUAD_POSITIONS, 3));
    geometry.setAttribute('uv', new BufferAttribute(QUAD_UVS, 2));
    geometry.setIndex(QUAD_INDEX);
    const attribute = (name: string, itemSize: number) => {
      const attr = new InstancedBufferAttribute(new Float32Array(capacity * itemSize), itemSize);
      attr.setUsage(DynamicDrawUsage);
      geometry.setAttribute(name, attr);
      return attr;
    };
    const attributes = {
      center: attribute('particleCenter', 3),
      size: attribute('particleSize', 2),
      rotation: attribute('particleRotation', 1),
      color: attribute('particleColor', 4),
      uv: attribute('particleUv', 4),
      extra: attribute('particleExtra', 4),
    };
    geometry.instanceCount = 0;
    const defaultMaterial = createThreeParticleMaterial(options);
    const material = options.material ? options.material(defaultMaterial) : defaultMaterial;
    if (material !== defaultMaterial) {
      defaultMaterial.dispose();
    }
    const mesh = new Mesh(geometry, material);
    mesh.name = 'GgParticleSystem';
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = options.renderOrder ?? 0;
    mesh.raycast = () => {};
    super(mesh);
    this.capacity = capacity;
    this.nativeGeometry = geometry;
    this.nativeMaterial = material;
    this.attributes = attributes;
    this._renderOptions = { ...options };
    this.sortIndices = new Uint32Array(capacity);
    this.sortDepths = new Float32Array(capacity);
  }

  public get texture(): Texture | null {
    return this._renderOptions.texture ?? null;
  }

  public set texture(value: Texture | null) {
    const hadMap = !!this._renderOptions.texture;
    this._renderOptions.texture = value;
    const material = this.nativeMaterial as ShaderMaterial;
    if (material.uniforms?.map) {
      material.uniforms.map.value = value;
    }
    if (material.defines && hadMap !== !!value) {
      if (value) {
        material.defines.GG_USE_MAP = '';
      } else {
        delete material.defines.GG_USE_MAP;
      }
      material.needsUpdate = true;
    }
  }

  /** Particles cast no shadows: setting this is ignored. */
  public get castShadow(): boolean {
    return false;
  }

  public set castShadow(_: boolean) {}

  /** Particles receive no shadows: setting this is ignored. */
  public get receiveShadow(): boolean {
    return false;
  }

  public set receiveShadow(_: boolean) {}

  setParticles(buffers: ParticleRenderBuffers): void {
    if (buffers.capacity > this.capacity) {
      throw new Error(
        `Particle buffers for ${buffers.capacity} particles don't fit a system of capacity ${this.capacity}`,
      );
    }
    if (buffers.dimensions !== 3) {
      throw new Error('A 3D particle system needs 3D particle buffers');
    }
    this.buffers = buffers;
    this.dirty = true;
  }

  /**
   * Fills the instance attributes from the current buffers for `camera`: sorted back to front from
   * its point of view when sorting is on. Called by the scene before each render; call it yourself
   * only when rendering the native scene some other way.
   */
  public prepareForCamera(camera: Camera): void {
    if (!this.buffers || !this.nativeMesh.visible) {
      return;
    }
    const material = this.nativeMaterial as ShaderMaterial;
    if (material.uniforms?.uFlipY) {
      material.uniforms.uFlipY.value = this.texture?.flipY === false ? 0 : 1;
    }
    const sorted =
      this._renderOptions.sort !== false && this.buffers.count > 1 && camera.layers.test(this.nativeMesh.layers);
    if (sorted) {
      this.inverseMatrix.copy(this.nativeMesh.matrixWorld).invert();
      camera.getWorldPosition(this.cameraPosition).applyMatrix4(this.inverseMatrix);
      camera.getWorldDirection(this.cameraDirection).transformDirection(this.inverseMatrix);
      sortParticlesBackToFront(
        this.buffers,
        this.cameraPosition,
        this.cameraDirection,
        this.sortIndices,
        this.sortDepths,
      );
      this.uploadParticles(this.sortIndices);
    } else if (this.dirty) {
      this.uploadParticles(null);
    }
    this.dirty = false;
  }

  private uploadParticles(order: Uint32Array | null): void {
    const b = this.buffers!;
    const n = b.count;
    const a = this.attributes;
    const center = a.center.array as Float32Array;
    const size = a.size.array as Float32Array;
    const rotation = a.rotation.array as Float32Array;
    const color = a.color.array as Float32Array;
    const uv = a.uv.array as Float32Array;
    const extra = a.extra.array as Float32Array;
    if (!order) {
      center.set(b.position.subarray(0, n * 3));
      size.set(b.size.subarray(0, n * 2));
      rotation.set(b.rotation.subarray(0, n));
      color.set(b.color.subarray(0, n * 4));
      uv.set(b.uv.subarray(0, n * 4));
      extra.set(b.extra.subarray(0, n * 4));
    } else {
      for (let i = 0; i < n; i++) {
        const j = order[i];
        center[i * 3] = b.position[j * 3];
        center[i * 3 + 1] = b.position[j * 3 + 1];
        center[i * 3 + 2] = b.position[j * 3 + 2];
        size[i * 2] = b.size[j * 2];
        size[i * 2 + 1] = b.size[j * 2 + 1];
        rotation[i] = b.rotation[j];
        for (let k = 0; k < 4; k++) {
          color[i * 4 + k] = b.color[j * 4 + k];
          uv[i * 4 + k] = b.uv[j * 4 + k];
          extra[i * 4 + k] = b.extra[j * 4 + k];
        }
      }
    }
    for (const attr of Object.values(a)) {
      attr.clearUpdateRanges();
      if (n > 0) {
        attr.addUpdateRange(0, n * attr.itemSize);
        attr.needsUpdate = true;
      }
    }
    this.nativeGeometry.instanceCount = n;
  }

  private readonly beforeRender = (camera: Camera) => this.prepareForCamera(camera);

  addToWorld(world: ThreeGgWorld): void {
    super.addToWorld(world);
    this.world = world;
    world.visualScene.beforeRenderHooks.add(this.beforeRender);
  }

  removeFromWorld(world: ThreeGgWorld, dispose?: boolean): void {
    world.visualScene.beforeRenderHooks.delete(this.beforeRender);
    this.world = null;
    super.removeFromWorld(world, dispose);
  }

  clone(): ThreeParticleSystemComponent {
    const copy = new ThreeParticleSystemComponent(this._renderOptions);
    copy.position = this.position;
    copy.rotation = this.rotation;
    copy.visible = this.visible;
    copy.nativeMesh.layers.mask = this.nativeMesh.layers.mask;
    return copy;
  }

  popChild(): null {
    return null;
  }

  dispose(): void {
    if (this.world) {
      this.world.visualScene.beforeRenderHooks.delete(this.beforeRender);
    }
    this.buffers = null;
    if (this.resourceOwnership === 'none') {
      return;
    }
    // geometry and material are this system's own; the texture belongs to whoever loaded it
    this.nativeGeometry.dispose();
    this.nativeMaterial.dispose();
  }
}
