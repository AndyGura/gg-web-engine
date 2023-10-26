---
title: three/components/three-scene.component.ts
nav_order: 103
parent: Modules
---

## three-scene.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ThreeSceneComponent (class)](#threescenecomponent-class)
    - [init (method)](#init-method)
    - [createRenderer (method)](#createrenderer-method)
    - [dispose (method)](#dispose-method)
    - [factory (property)](#factory-property)
    - [loader (property)](#loader-property)
    - [debugPhysicsDrawerClass (property)](#debugphysicsdrawerclass-property)

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
    rendererOptions?: Partial<RendererOptions>,
  ): ThreeRendererComponent
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

### debugPhysicsDrawerClass (property)

**Signature**

```ts
readonly debugPhysicsDrawerClass: typeof ThreePhysicsDrawer
```
