---
title: three/components/three-particle-system.component.ts
nav_order: 229
parent: Modules
---

## three-particle-system.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [THREE_PARTICLE_FRAGMENT_SHADER](#three_particle_fragment_shader)
  - [THREE_PARTICLE_VERTEX_SHADER](#three_particle_vertex_shader)
  - [ThreeParticleSystemComponent (class)](#threeparticlesystemcomponent-class)
    - [setParticles (method)](#setparticles-method)
    - [prepareForCamera (method)](#prepareforcamera-method)
    - [uploadParticles (method)](#uploadparticles-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [clone (method)](#clone-method)
    - [popChild (method)](#popchild-method)
    - [dispose (method)](#dispose-method)
    - [capacity (property)](#capacity-property)
    - [nativeGeometry (property)](#nativegeometry-property)
    - [nativeMaterial (property)](#nativematerial-property)
    - [nativeMesh (property)](#nativemesh-property)
  - [ThreeParticleSystemExtraOpts (type alias)](#threeparticlesystemextraopts-type-alias)
  - [createThreeParticleMaterial](#createthreeparticlematerial)

---

# utils

## THREE_PARTICLE_FRAGMENT_SHADER

The built-in particle fragment shader: texture (`GG_USE_MAP`) times tint, alpha from the texture
(or, with `GG_TEXTURE_ALPHA_BRIGHTNESS`, its brightest channel as stored in the image, i.e. in
the output color space) times opacity, `uAlphaTest`
discard, tone mapping, output color space and fog (faded out instead of mixed towards the fog
color with `GG_FOG_FADE`, for blend modes that add or darken), and premultiplied output - by the
alpha, or by the opacity alone with `GG_PREMULTIPLIED_INPUT`.

**Signature**

```ts
export declare const THREE_PARTICLE_FRAGMENT_SHADER: '\n#include <fog_pars_fragment>\n#ifdef GG_USE_MAP\nuniform sampler2D map;\n#endif\nuniform float uAlphaTest;\nvarying vec2 vUv;\nvarying vec4 vColor;\nvarying vec4 vExtra;\nvoid main() {\n#ifdef GG_USE_MAP\n  vec4 texel = texture2D(map, vUv);\n#else\n  vec4 texel = vec4(1.0);\n#endif\n#ifdef GG_TEXTURE_ALPHA_BRIGHTNESS\n  // brightness as stored in the image (output color space), not of the linearized texel\n  vec3 imageColor = linearToOutputTexel(vec4(texel.rgb, 1.0)).rgb;\n  float textureAlpha = max(imageColor.r, max(imageColor.g, imageColor.b)) * texel.a;\n#else\n  float textureAlpha = texel.a;\n#endif\n  vec3 color = texel.rgb * sRGBTransferEOTF(vec4(vColor.rgb, 1.0)).rgb;\n  float opacity = vColor.a;\n#ifdef USE_FOG\n  #ifdef FOG_EXP2\n  float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);\n  #else\n  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);\n  #endif\n  #ifdef GG_FOG_FADE\n  opacity *= 1.0 - fogFactor;\n  #endif\n#endif\n  float alpha = textureAlpha * opacity;\n  if (alpha <= uAlphaTest) discard;\n  gl_FragColor = vec4(color, alpha);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n#if defined(USE_FOG) && !defined(GG_FOG_FADE)\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);\n#endif\n#ifdef GG_PREMULTIPLIED_INPUT\n  gl_FragColor.rgb *= opacity;\n#else\n  gl_FragColor.rgb *= alpha;\n#endif\n}\n'
```

## THREE_PARTICLE_VERTEX_SHADER

The built-in particle vertex shader: expands each instance of the unit quad (`position.xy` in
`-0.5..0.5`, `uv` in `0..1`) into a sprite of `particleSize` world units around `particleCenter`,
rotated by `particleRotation` in its own plane and facing the camera (or, with the
`GG_BILLBOARD_VERTICAL` define, turning around world `Z` only). Passes `vUv` (the atlas region,
`particleUv`, flipped for the texture's `flipY` through the `uFlipY` uniform), `vColor`
(`particleColor`: sRGB tint and opacity) and `vExtra` (`particleExtra`) on, and supports fog.

**Signature**

```ts
export declare const THREE_PARTICLE_VERTEX_SHADER: "\n#include <fog_pars_vertex>\nattribute vec3 particleCenter;\nattribute vec2 particleSize;\nattribute float particleRotation;\nattribute vec4 particleColor;\nattribute vec4 particleUv;\nattribute vec4 particleExtra;\nuniform float uFlipY;\nvarying vec2 vUv;\nvarying vec4 vColor;\nvarying vec4 vExtra;\nvoid main() {\n  vec2 corner = position.xy * particleSize;\n  float c = cos(particleRotation);\n  float s = sin(particleRotation);\n  corner = vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y);\n#ifdef GG_BILLBOARD_VERTICAL\n  vec3 worldCenter = (modelMatrix * vec4(particleCenter, 1.0)).xyz;\n  vec2 toCamera = cameraPosition.xy - worldCenter.xy;\n  float toCameraLength = length(toCamera);\n  vec3 right = toCameraLength > 1e-6 ? vec3(-toCamera.y, toCamera.x, 0.0) / toCameraLength : vec3(1.0, 0.0, 0.0);\n  vec4 mvPosition = viewMatrix * vec4(worldCenter + right * corner.x + vec3(0.0, 0.0, corner.y), 1.0);\n#else\n  vec4 mvPosition = modelViewMatrix * vec4(particleCenter, 1.0);\n  mvPosition.xy += corner;\n#endif\n  gl_Position = projectionMatrix * mvPosition;\n  // particleUv is in image coordinates (top-left origin, y down); the quad's top edge is uv.y = 1\n  vec2 imageUv = vec2(particleUv.x + uv.x * particleUv.z, particleUv.y + (1.0 - uv.y) * particleUv.w);\n  vUv = vec2(imageUv.x, uFlipY > 0.5 ? 1.0 - imageUv.y : imageUv.y);\n  vColor = particleColor;\n  vExtra = particleExtra;\n#include <fog_vertex>\n}\n"
```

## ThreeParticleSystemComponent (class)

The three.js `IParticleSystem3dComponent`: one `Mesh` of an `InstancedBufferGeometry` - a unit
quad drawn once per particle in a single draw call. Per-instance attributes, filled from core's
`ParticleRenderBuffers` right before each camera renders the scene (sorted back to front for that
camera unless `sort: false`):

- `particleCenter` (vec3), `particleSize` (vec2, world units), `particleRotation` (float, radians),
- `particleColor` (vec4: sRGB tint and opacity), `particleUv` (vec4: atlas region `x, y, width,
height`, top-left origin), `particleExtra` (vec4: `Particle.shaderData`).

The mesh is never frustum-culled, casts no shadows and is ignored by three.js raycasting. Sorting
runs in the scene's `onBeforeRender` (see `ThreeSceneComponent.beforeRenderHooks`): an app must
not replace `nativeScene.onBeforeRender`.

**Signature**

```ts
export declare class ThreeParticleSystemComponent {
  constructor(options: ParticleSystem3dRenderOptions<Texture> & ThreeParticleSystemExtraOpts)
}
```

### setParticles (method)

**Signature**

```ts
setParticles(buffers: ParticleRenderBuffers): void
```

### prepareForCamera (method)

Fills the instance attributes from the current buffers for `camera`: sorted back to front from
its point of view when sorting is on. Called by the scene before each render; call it yourself
only when rendering the native scene some other way.

**Signature**

```ts
public prepareForCamera(camera: Camera): void
```

### uploadParticles (method)

**Signature**

```ts
private uploadParticles(order: Uint32Array | null): void
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: ThreeGgWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: ThreeGgWorld, dispose?: boolean): void
```

### clone (method)

**Signature**

```ts
clone(): ThreeParticleSystemComponent
```

### popChild (method)

**Signature**

```ts
popChild(): null
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### capacity (property)

**Signature**

```ts
readonly capacity: number
```

### nativeGeometry (property)

**Signature**

```ts
readonly nativeGeometry: InstancedBufferGeometry
```

### nativeMaterial (property)

**Signature**

```ts
readonly nativeMaterial: Material<MaterialEventMap>
```

### nativeMesh (property)

**Signature**

```ts
nativeMesh: Mesh<InstancedBufferGeometry, Material<MaterialEventMap>, Object3DEventMap>
```

## ThreeParticleSystemExtraOpts (type alias)

three.js-only particle system options, merged into `ParticleSystem3dRenderOptions` when creating a
system (`factory.createParticleSystem` / `world.addParticleSystem`).

**Signature**

```ts
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
  material?: (defaultMaterial: ShaderMaterial) => Material
}
```

## createThreeParticleMaterial

The built-in particle material for `options`: a `ShaderMaterial` with the shaders above, the
blend mode as three.js blending with `premultipliedAlpha` (the shader outputs premultiplied
color), `transparent`, depth test/write and fog from the options.

**Signature**

```ts
export declare function createThreeParticleMaterial(options: ParticleSystem3dRenderOptions<Texture>): ShaderMaterial
```
