---
title: core/3d/entities/controllers/input/orbit-camera.controller.ts
nav_order: 40
parent: Modules
---

## orbit-camera.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [OrbitCameraController (class)](#orbitcameracontroller-class)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [tickOrder (property)](#tickorder-property)
    - [options (property)](#options-property)
    - [mouseInput (property)](#mouseinput-property)
    - [spherical (property)](#spherical-property)
    - [target (property)](#target-property)
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

### spherical (property)

**Signature**

```ts
spherical: MutableSpherical
```

### target (property)

**Signature**

```ts
target: Point3
```

## OrbitCameraControllerOptions (type alias)

**Signature**

```ts
export type OrbitCameraControllerOptions = {
  mouseOptions: Partial<MouseInputOptions>
  orbiting: { sensitivityX: number; sensitivityY: number } | false
  zooming: { sensitivity: number } | false
  panning: { sensitivityX: number; sensitivityY: number } | false
  dollying: { sensitivity: number } | false
}
```
