---
title: core/3d/entities/controllers/input/orbit-camera.controller.ts
nav_order: 41
parent: Modules
---

## orbit-camera.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [OrbitCameraController (class)](#orbitcameracontroller-class)
    - [reset (method)](#reset-method)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [tickOrder (property)](#tickorder-property)
    - [options (property)](#options-property)
    - [mouseInput (property)](#mouseinput-property)
    - [\_spherical (property)](#_spherical-property)
    - [target (property)](#target-property)
    - [resetMotion$ (property)](#resetmotion-property)
  - [OrbitCameraControllerOptions (type alias)](#orbitcameracontrolleroptions-type-alias)

---

# utils

## OrbitCameraController (class)

**Signature**

```ts
export declare class OrbitCameraController {
  constructor(protected readonly camera: Renderer3dEntity, options: Partial<OrbitCameraControllerOptions> = {})
}
```

### reset (method)

**Signature**

```ts
public reset(): void
```

### onSpawned (method)

**Signature**

```ts
async onSpawned(world: GgWorld<any, any>): Promise<void>
```

### onRemoved (method)

**Signature**

```ts
async onRemoved(): Promise<void>
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: TickOrder.INPUT_CONTROLLERS
```

### options (property)

**Signature**

```ts
readonly options: OrbitCameraControllerOptions
```

### mouseInput (property)

**Signature**

```ts
readonly mouseInput: MouseInput
```

### \_spherical (property)

**Signature**

```ts
_spherical: MutableSpherical
```

### target (property)

**Signature**

```ts
target: Point3
```

### resetMotion$ (property)

**Signature**

```ts
resetMotion$: any
```

## OrbitCameraControllerOptions (type alias)

**Signature**

```ts
export type OrbitCameraControllerOptions = {
  /**
   * Options for configuring mouse input.
   */
  mouseOptions: Partial<MouseInputOptions>
  /**
   * Orbiting options. false disables orbiting, sensitivity fields are the speed in radians per 1000px mouse movement. 1 by default
   */
  orbiting: { sensitivityX: number; sensitivityY: number } | false
  /**
   * An elasticity factor for orbiting. 0 by default (no elastic motion)
   */
  orbitingElasticity: number
  /**
   * Zooming options. false disables zooming. Enabled by default
   */
  zooming: { sensitivity: number } | false
  /**
   * Panning options. false disables panning. Enabled by default
   */
  panning: { sensitivityX: number; sensitivityY: number } | false
  /**
   * Dollying options. false disables dollying. Enabled by default
   */
  dollying: { sensitivity: number } | false
}
```
