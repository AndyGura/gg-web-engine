---
title: three/components/three-scene.component.ts
nav_order: 131
parent: Modules
---

## three-scene.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ThreeSceneComponent (class)](#threescenecomponent-class)
    - [init (method)](#init-method)
    - [createRenderer (method)](#createrenderer-method)
    - [createComposerRenderer (method)](#createcomposerrenderer-method)
    - [dispose (method)](#dispose-method)
    - [factory (property)](#factory-property)
    - [loader (property)](#loader-property)

---

# utils

## ThreeSceneComponent (class)

**Signature**

```ts
export declare class ThreeSceneComponent
```

### init (method)

**Signature**

```ts
async init(): Promise<void>
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
