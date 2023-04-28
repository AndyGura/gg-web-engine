---
title: core/3d/entities/controllers/input/orbit-camera.controller.ts
nav_order: 23
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
  - [OrbitCameraControllerOptions (type alias)](#orbitcameracontrolleroptions-type-alias)

---

# utils

## OrbitCameraController (class)

**Signature**

```ts
export declare class OrbitCameraController {
  constructor(protected readonly camera: Gg3dCameraEntity, options: Partial<OrbitCameraControllerOptions> = {})
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
readonly tickOrder: GGTickOrder.INPUT_CONTROLLERS
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

## OrbitCameraControllerOptions (type alias)

**Signature**

```ts
export type OrbitCameraControllerOptions = {
  mouseOptions: Partial<MouseInputOptions>
  target: Point3
  orbiting: { sensitivityX: number; sensitivityY: number } | false
  zooming: { sensitivity: number } | false
  panning: { sensitivityX: number; sensitivityY: number } | false
  dollying: { sensitivity: number } | false
}
```
