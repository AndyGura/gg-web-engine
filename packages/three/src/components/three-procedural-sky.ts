import { proceduralSkyBodies, ResolvedProceduralSky3dOpts } from '@gg-web-engine/core';
import {
  BackSide,
  BoxGeometry,
  Color,
  CubeCamera,
  HalfFloatType,
  Matrix3,
  Matrix4,
  Mesh,
  PMREMGenerator,
  Quaternion,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector3,
  WebGLCubeRenderTarget,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';

/**
 * Uniforms and functions both sky shaders share: the light of the sun and the moon through the air.
 * Single scattering (Rayleigh and Mie), with the optical depth of a ray taken from its air mass.
 */
const ATMOSPHERE_GLSL = /* glsl */ `
uniform vec3 uSunDirection;
uniform vec3 uMoonDirection;
uniform float uHaze;
uniform float uMoon;

// zenith optical depth of a clear atmosphere per channel (Rayleigh)
const vec3 RAYLEIGH = vec3(0.0465, 0.108, 0.265);
const float SUN_ILLUMINANCE = 9.0;
const float MOON_ILLUMINANCE = 0.12;

// optical depth of haze, dust and humidity
float skyMie() {
  return 0.005 + 0.3 * uHaze * uHaze;
}

// how much more air a ray crosses than one going straight up; about 40 along the horizon
float airMass(float cosZenith) {
  float c = clamp(cosZenith, 0.0, 1.0);
  return 1.0 / (c + 0.025 * exp(-11.0 * c));
}

float henyeyGreenstein(float cosTheta, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
}

// light scattered towards the viewer along direction v by a light source in direction l
vec3 inscatter(vec3 v, vec3 l, float illuminance, float mie, out vec3 viewTransmittance, out vec3 lightTransmittance) {
  vec3 tau = RAYLEIGH + mie;
  viewTransmittance = exp(-tau * airMass(v.z));
  // light seen higher up was scattered higher in the air, where its own way from the sun is shorter
  float altitude = 1.0 - v.z;
  lightTransmittance = exp(-tau * airMass(l.z) * (0.3 + 0.7 * altitude * altitude * altitude));
  float cosTheta = dot(v, l);
  float rayleighPhase = 3.0 / (16.0 * PI) * (1.0 + cosTheta * cosTheta);
  float miePhase = henyeyGreenstein(cosTheta, 0.8 - 0.1 * uHaze);
  vec3 scatter = (RAYLEIGH * rayleighPhase + mie * miePhase) / tau;
  // light scattered more than once, roughly the same from every direction
  vec3 multiple = (RAYLEIGH * 0.03 + mie * 0.04) / tau;
  float fade = smoothstep(-0.12, 0.02, l.z);
  return illuminance * fade * lightTransmittance * (scatter + multiple) * (1.0 - viewTransmittance);
}

// the glow left after sunset (and before sunrise): blue overhead, warm along the horizon under the sun
vec3 twilight(vec3 v, vec3 l) {
  if (l.z < -0.22 || l.z > 0.12) return vec3(0.0);
  float below = smoothstep(-0.22, -0.02, l.z) * (1.0 - smoothstep(-0.02, 0.12, l.z));
  vec2 towardsLight = normalize(l.xy + vec2(1e-5));
  float facing = max(dot(normalize(v.xy + vec2(1e-5)), towardsLight), 0.0);
  vec3 blue = vec3(0.012, 0.022, 0.055) * (0.6 + 0.4 * v.z);
  vec3 band = vec3(0.09, 0.03, 0.008) * facing * facing * exp(-v.z * 7.0);
  return SUN_ILLUMINANCE / 9.0 * below * (blue + band) * smoothstep(-0.22, -0.05, l.z) * 4.0;
}
`;

/**
 * Vertex shader of the procedural sky: a unit box around the viewer, drawn at the far plane. It
 * also works out the light that is the same for every pixel (sunlight and moonlight reaching the
 * clouds, light from the sky overhead), so the fragment shader doesn't repeat it per pixel.
 */
export const THREE_PROCEDURAL_SKY_VERTEX_SHADER = /* glsl */ `
#include <common>
${ATMOSPHERE_GLSL}

varying vec3 vDirection;
varying vec3 vCloudSun;
varying vec3 vCloudMoon;
varying vec3 vSkyAmbient;

void main() {
  vDirection = position;
  // rotation only: the sky is infinitely far away, wherever the camera stands
  vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = clip.xyww;

  float mie = skyMie();
  vec3 tau = RAYLEIGH + mie;
  float sunUp = smoothstep(-0.12, 0.02, uSunDirection.z);
  float moonUp = smoothstep(-0.12, 0.02, uMoonDirection.z) * uMoon;
  // direct light through the air at the clouds' height
  vCloudSun = SUN_ILLUMINANCE * sunUp * exp(-tau * airMass(uSunDirection.z) * 0.6);
  vCloudMoon = MOON_ILLUMINANCE * moonUp * exp(-tau * airMass(uMoonDirection.z) * 0.6);
  vec3 zenith = vec3(0.0, 0.0, 1.0);
  vec3 viewT;
  vec3 lightT;
  vSkyAmbient = inscatter(zenith, uSunDirection, SUN_ILLUMINANCE, mie, viewT, lightT)
    + inscatter(zenith, uMoonDirection, MOON_ILLUMINANCE * uMoon, mie, viewT, lightT)
    + twilight(zenith, uSunDirection);
}
`;

/**
 * Fragment shader of the procedural sky. The world is Z-up, so `vDirection.z` is the height above
 * the horizon. The atmosphere, one noise-generated cloud layer, a hashed star field and a moon
 * disc.
 */
export const THREE_PROCEDURAL_SKY_FRAGMENT_SHADER = /* glsl */ `
#include <common>
${ATMOSPHERE_GLSL}

uniform mat3 uStarRotation;
uniform float uSunSize;
uniform float uExposure;
uniform vec3 uGroundColor;
uniform float uCoverage;
uniform float uDensity;
uniform float uCloudScale;
uniform vec2 uCloudOffset;
uniform float uStars;
uniform float uMoonSize;
uniform float uTime;

varying vec3 vDirection;
varying vec3 vCloudSun;
varying vec3 vCloudMoon;
varying vec3 vSkyAmbient;

// "Hash without Sine" by David Hoskins (MIT)
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p, int octaves) {
  const mat2 turn = mat2(1.6, 1.2, -1.2, 1.6);
  float value = 0.0;
  float total = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    if (i >= octaves) break;
    value += amplitude * valueNoise(p);
    total += amplitude;
    p = turn * p;
    amplitude *= 0.5;
  }
  return value / total;
}

float starLayer(vec3 direction, float density) {
  vec3 p = direction * density;
  vec3 cell = floor(p);
  vec3 h = hash33(cell);
  if (h.x < 0.78) return 0.0;
  vec3 star = cell + 0.25 + 0.5 * hash33(cell + 17.0);
  float pixel = length(fwidth(p));
  float radius = max(0.05, pixel * 0.7);
  float d = length(p - star);
  float brightness = pow(h.y, 6.0) * 6.0 + 0.4;
  float twinkle = 0.7 + 0.3 * sin(uTime * (1.5 + 3.0 * h.z) + h.y * 6.2831);
  // spread the same light over a larger spot when a star is smaller than a pixel
  float energy = min(1.0, (0.05 * 0.05) / (radius * radius));
  return brightness * twinkle * energy * exp(-d * d / (radius * radius));
}

void main() {
  vec3 v = normalize(vDirection);
  vec3 sky = normalize(vec3(v.xy, max(v.z, 0.0)));
  float mie = skyMie();

  vec3 viewT;
  vec3 sunT;
  vec3 moonT = vec3(0.0);
  vec3 color = inscatter(sky, uSunDirection, SUN_ILLUMINANCE, mie, viewT, sunT);
  float moonUp = smoothstep(-0.12, 0.02, uMoonDirection.z) * uMoon;
  if (moonUp > 0.0) {
    color += inscatter(sky, uMoonDirection, MOON_ILLUMINANCE * uMoon, mie, viewT, moonT);
  }
  color += twilight(sky, uSunDirection);
  // airglow: the night sky is never perfectly black
  color += vec3(0.0006, 0.0009, 0.0018) * (1.0 + 2.0 * (1.0 - sky.z));
  vec3 skyLight = color;

  // sun, moon and stars, hidden by clouds below
  float sunUp = smoothstep(-0.12, 0.02, uSunDirection.z);
  vec3 sunLight = SUN_ILLUMINANCE * sunUp * sunT;
  float cosSun = dot(sky, uSunDirection);
  float sunDisc = smoothstep(cos(uSunSize), cos(uSunSize * 0.8), cosSun);
  vec3 bodies = sunDisc * sunLight * 8.0;
  float cosMoon = dot(sky, uMoonDirection);
  if (moonUp > 0.0 && cosMoon > cos(uMoonSize)) {
    float moonDisc = smoothstep(cos(uMoonSize), cos(uMoonSize * 0.85), cosMoon);
    float craters = 0.75 + 0.25 * valueNoise((sky.xy - uMoonDirection.xy) / uMoonSize * 2.5 + 3.0);
    bodies += moonDisc * craters * vec3(0.85, 0.88, 0.95) * uMoon * smoothstep(-0.02, 0.03, uMoonDirection.z) * viewT;
  }
  float night = (1.0 - smoothstep(-0.18, 0.0, uSunDirection.z)) * uStars;
  if (night > 0.0) {
    vec3 starDirection = uStarRotation * sky;
    bodies += night * viewT * (starLayer(starDirection, 140.0) + 0.6 * starLayer(starDirection, 330.0));
  }
  // nothing of them shows through the ground
  color += bodies * step(0.0, v.z);

  // cloud layer: noise on a plane high above the viewer, seen through the atmosphere
  if (uCoverage > 0.0 && uDensity > 0.0) {
    float lift = sky.z + 0.06;
    vec2 p = sky.xy / lift / uCloudScale * 0.7 + uCloudOffset;
    float distance = 1.0 / lift;
    int octaves = distance > 6.0 ? 3 : (distance > 3.0 ? 4 : 5);
    float n = fbm(p, octaves);
    float cover = uCoverage * 1.3;
    float cloud = smoothstep(0.0, 0.35, n - 1.0 + cover);
    float overcast = uCoverage * uCoverage * uDensity;
    float alpha = cloud * uDensity * mix(smoothstep(0.0, 0.03, sky.z), 1.0, overcast);
    // thickness towards the sun: a lit side and a shadowed side
    vec2 towardsLight = (uSunDirection.z > -0.1 ? uSunDirection.xy : uMoonDirection.xy) * 0.12;
    float shade = smoothstep(0.0, 0.35, fbm(p + towardsLight, 3) - 1.0 + cover);
    // a deck of clouds is darker where it is thicker, which keeps an overcast sky from being flat
    float thickness = smoothstep(0.3, 0.8, n);
    float darkening = mix(1.0, 0.4, overcast) * (1.0 - 0.45 * shade * uDensity) * mix(1.0, 1.35 - 0.7 * thickness, overcast);
    float silver = henyeyGreenstein(cosSun, 0.6) * (1.0 - cloud) * 4.0;
    vec3 direct = (vCloudSun + vCloudMoon) * (0.12 * darkening + 0.08 * silver);
    vec3 ambient = (vCloudSun + vCloudMoon) * 0.04 + vSkyAmbient * 0.9 + skyLight * 0.15;
    vec3 cloudColor = (direct + ambient) * darkening + vec3(0.0006, 0.0008, 0.001);
    // far clouds fade into the air in front of them
    cloudColor = mix(cloudColor, skyLight, 1.0 - exp(-distance * (0.03 + 0.06 * uHaze)));
    // the sun shines through as a bright smudge
    cloudColor += vCloudSun * pow(max(cosSun, 0.0), 60.0) * 0.08 * (1.0 - 0.6 * overcast);
    color = mix(color, cloudColor, alpha);
  }

  // ground below the horizon, lit by the sky, blending into the horizon haze
  if (v.z < 0.0) {
    vec3 groundLight = (vCloudSun * max(uSunDirection.z, 0.0) + vCloudMoon * max(uMoonDirection.z, 0.0)) * 0.08 + vSkyAmbient * 0.6;
    vec3 ground = uGroundColor * groundLight;
    color = mix(color, ground, smoothstep(0.0, 0.015 + 0.1 * uHaze, -v.z));
  }

  color = 1.0 - exp(-color * uExposure);
  color += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(max(color, 0.0), 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * One procedural sky: its shader material, drawn every frame as a box around the camera
 * (`mesh`), or drawn into a cube texture (`bake`) and shown or used for lighting from there.
 */
export class ThreeProceduralSky {
  public readonly material: ShaderMaterial;
  /** The sky drawn directly: a box the shader puts at the far plane, around whichever camera renders it. */
  public readonly mesh: Mesh;

  private _options: ResolvedProceduralSky3dOpts | null = null;
  public get options(): ResolvedProceduralSky3dOpts | null {
    return this._options;
  }
  /** Settings the current bake was made with, minus the ones that don't change it. */
  private bakedKey: string | null = null;
  private cubeTarget: WebGLCubeRenderTarget | null = null;
  private cubeCamera: CubeCamera | null = null;
  private readonly bakeScene: Scene = new Scene();
  private pmremTarget: WebGLRenderTarget | null = null;
  private pmremGenerator: PMREMGenerator | null = null;
  private pmremValid: boolean = false;
  private lastAdvance: number | null = null;

  constructor() {
    this.material = new ShaderMaterial({
      name: 'gg-procedural-sky',
      vertexShader: THREE_PROCEDURAL_SKY_VERTEX_SHADER,
      fragmentShader: THREE_PROCEDURAL_SKY_FRAGMENT_SHADER,
      uniforms: {
        uSunDirection: { value: new Vector3(0, 0, 1) },
        uMoonDirection: { value: new Vector3(0, 0, -1) },
        uStarRotation: { value: new Matrix3() },
        uSunSize: { value: 0.02 },
        uHaze: { value: 0.2 },
        uExposure: { value: 1 },
        uGroundColor: { value: new Color() },
        uCoverage: { value: 0 },
        uDensity: { value: 0 },
        uCloudScale: { value: 1 },
        uCloudOffset: { value: new Vector2() },
        uStars: { value: 1 },
        uMoon: { value: 1 },
        uMoonSize: { value: 0.025 },
        uTime: { value: 0 },
      },
      side: BackSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
    const geometry = new BoxGeometry(1, 1, 1);
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.name = 'gg-procedural-sky';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -Number.MAX_SAFE_INTEGER;
    this.mesh.layers.enableAll();
    this.mesh.raycast = () => {};
    this.bakeScene.add(new Mesh(geometry, this.material));
  }

  /** Applies new settings; a bake made with different ones is redone at the next `bake`. */
  setOptions(options: ResolvedProceduralSky3dOpts): void {
    this._options = options;
    const u = this.material.uniforms;
    const { sunDirection, moonDirection, starRotation } = proceduralSkyBodies(options);
    u.uSunDirection.value.set(sunDirection.x, sunDirection.y, sunDirection.z);
    u.uMoonDirection.value.set(moonDirection.x, moonDirection.y, moonDirection.z);
    // the shader turns a view direction into the star field's own frame
    const q = new Quaternion(starRotation.x, starRotation.y, starRotation.z, starRotation.w).invert();
    u.uStarRotation.value.setFromMatrix4(new Matrix4().makeRotationFromQuaternion(q));
    u.uSunSize.value = options.sunSize;
    u.uHaze.value = options.haze;
    u.uExposure.value = options.exposure;
    u.uGroundColor.value.set(options.groundColor);
    u.uCoverage.value = options.clouds ? options.clouds.coverage : 0;
    u.uDensity.value = options.clouds ? options.clouds.density : 0;
    u.uCloudScale.value = options.clouds ? Math.max(0.01, options.clouds.scale) : 1;
    u.uStars.value = options.stars;
    u.uMoon.value = options.moon;
    u.uMoonSize.value = options.moonSize;
  }

  /** Moves the clouds with the wind and the stars' twinkle on by the time since the last call. */
  advance(now: number): void {
    const dt = this.lastAdvance === null ? 0 : Math.min(0.1, Math.max(0, (now - this.lastAdvance) / 1000));
    this.lastAdvance = now;
    const u = this.material.uniforms;
    u.uTime.value += dt;
    const wind = this._options?.clouds?.wind;
    if (wind) {
      u.uCloudOffset.value.x += wind.x * dt;
      u.uCloudOffset.value.y += wind.y * dt;
    }
  }

  private currentKey(resolution: number): string {
    const { clouds, mode, ...rest } = this._options!;
    return JSON.stringify([rest, clouds ? { ...clouds, wind: null } : null, resolution]);
  }

  /** The sky drawn into a cube texture `resolution` pixels per side; drawn again only when a setting changed. */
  bake(renderer: WebGLRenderer, resolution: number): Texture {
    const key = this.currentKey(resolution);
    if (!this.cubeTarget || this.cubeTarget.width !== resolution) {
      this.cubeTarget?.dispose();
      this.cubeTarget = new WebGLCubeRenderTarget(resolution, { type: HalfFloatType });
      this.cubeCamera = new CubeCamera(0.1, 10, this.cubeTarget);
      this.bakedKey = null;
    }
    if (this.bakedKey !== key) {
      this.cubeCamera!.update(renderer, this.bakeScene);
      this.bakedKey = key;
      this.pmremValid = false;
    }
    return this.cubeTarget.texture;
  }

  /** The baked sky prefiltered for image-based lighting (see `bake`). */
  bakeEnvironment(renderer: WebGLRenderer, resolution: number): Texture {
    const cube = this.bake(renderer, resolution);
    if (!this.pmremValid || !this.pmremTarget) {
      this.pmremGenerator ??= new PMREMGenerator(renderer);
      this.pmremTarget = this.pmremGenerator.fromCubemap(cube as any, this.pmremTarget ?? undefined);
      this.pmremValid = true;
    }
    return this.pmremTarget.texture;
  }

  /** Whether `bake`/`bakeEnvironment` would draw again. */
  get needsBake(): boolean {
    return !this._options || !this.cubeTarget || this.bakedKey !== this.currentKey(this.cubeTarget.width);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.cubeTarget?.dispose();
    this.pmremTarget?.dispose();
    this.pmremGenerator?.dispose();
  }
}
