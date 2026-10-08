---
title: pixi/components/pixi-scene.component.ts
nav_order: 189
parent: Modules
---

## pixi-scene.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [PixiSceneComponent (class)](#pixiscenecomponent-class)
    - [init (method)](#init-method)
    - [setEnvironment (method)](#setenvironment-method)
    - [createRenderer (method)](#createrenderer-method)
    - [dispose (method)](#dispose-method)
    - [backendName (property)](#backendname-property)
    - [factory (property)](#factory-property)
    - [renderers (property)](#renderers-property)
    - [parallaxLayers (property)](#parallaxlayers-property)

---

# utils

## PixiSceneComponent (class)

**Signature**

```ts
export declare class PixiSceneComponent {
  constructor()
}
```

### init (method)

**Signature**

```ts
async init(): Promise<void>
```

### setEnvironment (method)

**Signature**

```ts
setEnvironment(environment: Partial<Environment2dOpts<Texture>>): void
```

### createRenderer (method)

**Signature**

```ts
createRenderer(
    camera: PixiCameraComponent,
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & ApplicationOptions>,
  ): PixiRendererComponent
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
readonly factory: PixiFactory
```

### renderers (property)

The renderers currently drawing this scene - what `PixiFactory.prepare` uploads to.

**Signature**

```ts
readonly renderers: Set<PixiRendererComponent>
```

### parallaxLayers (property)

Parallax layers currently in this scene - each renderer positions them for its own camera.

**Signature**

```ts
readonly parallaxLayers: Set<PixiParallaxLayerComponent>
```
