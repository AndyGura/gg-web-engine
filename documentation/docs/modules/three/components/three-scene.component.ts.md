---
title: three/components/three-scene.component.ts
nav_order: 232
parent: Modules
---

## three-scene.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ThreeSceneComponent (class)](#threescenecomponent-class)
    - [zUpRotationX (static method)](#zuprotationx-static-method)
    - [init (method)](#init-method)
    - [createNativeScene (method)](#createnativescene-method)
    - [setEnvironment (method)](#setenvironment-method)
    - [applyEnvironment (method)](#applyenvironment-method)
    - [registerRenderLayer (method)](#registerrenderlayer-method)
    - [deregisterRenderLayer (method)](#deregisterrenderlayer-method)
    - [createRenderer (method)](#createrenderer-method)
    - [createComposerRenderer (method)](#createcomposerrenderer-method)
    - [dispose (method)](#dispose-method)
    - [backendName (property)](#backendname-property)
    - [factory (property)](#factory-property)
    - [loader (property)](#loader-property)
    - [renderers (property)](#renderers-property)
    - [mainRenderLayer (property)](#mainrenderlayer-property)
    - [beforeRenderHooks (property)](#beforerenderhooks-property)
    - [lockedRenderLayers (property)](#lockedrenderlayers-property)

---

# utils

## ThreeSceneComponent (class)

**Signature**

```ts
export declare class ThreeSceneComponent
```

### zUpRotationX (static method)

three.js samples sky textures Y-up - an equirectangular panorama's top edge and a cube map's
`py` slot are both towards `+Y` - so they're turned a quarter around X to put that overhead in
the engine's Z-up world (`ThreeLoader.loadCubeTexture` fills the cube slots to match).

**Signature**

```ts
private static zUpRotationX(texture: Texture | null): number
```

### init (method)

**Signature**

```ts
async init(): Promise<void>
```

### createNativeScene (method)

**Signature**

```ts
private createNativeScene(): Scene
```

### setEnvironment (method)

**Signature**

```ts
setEnvironment(environment: Partial<Environment3dOpts<Texture>>): void
```

### applyEnvironment (method)

**Signature**

```ts
private applyEnvironment(): void
```

### registerRenderLayer (method)

**Signature**

```ts
registerRenderLayer(): RenderLayer
```

### deregisterRenderLayer (method)

**Signature**

```ts
deregisterRenderLayer(layer: RenderLayer): void
```

### createRenderer (method)

**Signature**

```ts
createRenderer(
    camera: ThreeCameraComponent,
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & WebGLRendererParameters>,
  ): ThreeRendererComponent
```

### createComposerRenderer (method)

**Signature**

```ts
createComposerRenderer(
    camera: ThreeCameraComponent,
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & WebGLRendererParameters>,
  ): ThreeComposerRendererComponent
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### backendName (property)

**Signature**

```ts
readonly backendName: string
```

### factory (property)

**Signature**

```ts
readonly factory: ThreeFactory
```

### loader (property)

**Signature**

```ts
readonly loader: ThreeLoader
```

### renderers (property)

The renderers currently drawing this scene - what `ThreeLoader.prepare` uploads to.

**Signature**

```ts
readonly renderers: Set<ThreeRendererComponent>
```

### mainRenderLayer (property)

**Signature**

```ts
readonly mainRenderLayer: number
```

### beforeRenderHooks (property)

Run at the start of every `WebGLRenderer.render` of this scene, with that render's camera -
before three.js uploads changed geometry, so a hook can still rewrite buffers for this camera
(`ThreeParticleSystemComponent` sorts its sprites here). Installed as the native scene's
`onBeforeRender`: an app must not replace that, and adds a hook here instead.

**Signature**

```ts
readonly beforeRenderHooks: Set<(camera: Camera, renderer: WebGLRenderer) => void>
```

### lockedRenderLayers (property)

**Signature**

```ts
lockedRenderLayers: number[]
```
