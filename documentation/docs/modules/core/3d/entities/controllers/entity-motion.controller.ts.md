---
title: core/3d/entities/controllers/entity-motion.controller.ts
nav_order: 20
parent: Modules
---

## entity-motion.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [EntityMotionController (class)](#entitymotioncontroller-class)
    - [transitFromStaticState (method)](#transitfromstaticstate-method)
    - [transitControlFunction (method)](#transitcontrolfunction-method)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [dispose (method)](#dispose-method)
    - [tick$ (property)](#tick-property)
    - [removed$ (property)](#removed-property)
    - [tickOrder (property)](#tickorder-property)
    - [lastValue (property)](#lastvalue-property)
  - [MotionControlFuncReturn (type alias)](#motioncontrolfuncreturn-type-alias)
  - [MotionControlFunction (type alias)](#motioncontrolfunction-type-alias)

---

# utils

## EntityMotionController (class)

**Signature**

```ts
export declare class EntityMotionController {
  constructor(
    public target: GgPositionable3dEntity,
    protected _motionControlFunction: MotionControlFunction,
    public customParametersHandleFunc: (target: GgPositionable3dEntity, params: any) => void = () => {}
  )
}
```

### transitFromStaticState (method)

**Signature**

```ts
transitFromStaticState(
    state: MotionControlFuncReturn,
    newFunc: MotionControlFunction,
    transitionDuration: number,
    easing: (t: number) => number = x => x,
    customParametersLerpFunc: (a: any, b: any, t: number) => any = (a, b, t) => b,
  )
```

### transitControlFunction (method)

**Signature**

```ts
transitControlFunction(
    newFunc: MotionControlFunction,
    transitionDuration: number,
    easing: (t: number) => number = x => x,
    customParametersLerpFunc: (a: any, b: any, t: number) => any = (a, b, t) => b,
  )
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: Gg3dWorld)
```

### onRemoved (method)

**Signature**

```ts
onRemoved()
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### tick$ (property)

**Signature**

```ts
readonly tick$: any
```

### removed$ (property)

**Signature**

```ts
readonly removed$: any
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: number
```

### lastValue (property)

**Signature**

```ts
lastValue: MotionControlFuncReturn | undefined
```

## MotionControlFuncReturn (type alias)

**Signature**

```ts
export type MotionControlFuncReturn = { position: Point3; rotation: Point4; customParameters: { [key: string]: any } }
```

## MotionControlFunction (type alias)

**Signature**

```ts
export type MotionControlFunction = (delta: number) => MotionControlFuncReturn
```
