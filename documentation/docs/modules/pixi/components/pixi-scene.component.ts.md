---
title: pixi/components/pixi-scene.component.ts
nav_order: 109
parent: Modules
---

## pixi-scene.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [PixiSceneComponent (class)](#pixiscenecomponent-class)
    - [init (method)](#init-method)
    - [createRenderer (method)](#createrenderer-method)
    - [dispose (method)](#dispose-method)
    - [factory (property)](#factory-property)

---

# utils

## PixiSceneComponent (class)

**Signature**

```ts
export declare class PixiSceneComponent
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
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & ApplicationOptions>,
  ): PixiRendererComponent
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### factory (property)

**Signature**

```ts
readonly factory: PixiFactory
```
