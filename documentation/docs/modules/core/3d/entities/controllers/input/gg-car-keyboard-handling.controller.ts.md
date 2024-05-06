---
title: core/3d/entities/controllers/input/gg-car-keyboard-handling.controller.ts
nav_order: 40
parent: Modules
---

## gg-car-keyboard-handling.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgCarKeyboardControllerOptions (type alias)](#ggcarkeyboardcontrolleroptions-type-alias)
  - [GgCarKeyboardHandlingController (class)](#ggcarkeyboardhandlingcontroller-class)
    - [onSpawned (method)](#onspawned-method)
    - [tickOrder (property)](#tickorder-property)
    - [carHandlingInput (property)](#carhandlinginput-property)
    - [switchingGearsEnabled (property)](#switchinggearsenabled-property)

---

# utils

## GgCarKeyboardControllerOptions (type alias)

**Signature**

```ts
export type GgCarKeyboardControllerOptions = CarKeyboardControllerOptions & {
  gearUpDownKeys: [string, string]
  autoReverse: boolean
  handbrakeKey: string
}
```

## GgCarKeyboardHandlingController (class)

**Signature**

```ts
export declare class GgCarKeyboardHandlingController {
  constructor(
    protected readonly keyboard: KeyboardInput,
    public car: GgCarEntity | null,
    protected readonly options: GgCarKeyboardControllerOptions = {
      keymap: 'arrows',
      maxSteerDeltaPerSecond: 12,
      gearUpDownKeys: ['KeyA', 'KeyZ'],
      autoReverse: true,
      handbrakeKey: 'Space',
    }
  )
}
```

### onSpawned (method)

**Signature**

```ts
async onSpawned(world: GgWorld<any, any>): Promise<void>
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: TickOrder.INPUT_CONTROLLERS
```

### carHandlingInput (property)

**Signature**

```ts
readonly carHandlingInput: CarKeyboardHandlingController
```

### switchingGearsEnabled (property)

**Signature**

```ts
switchingGearsEnabled: boolean
```
