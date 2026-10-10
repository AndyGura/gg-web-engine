---
title: core/3d/entities/controllers/input/gg-car-handling.controller.ts
nav_order: 74
parent: Modules
---

## gg-car-handling.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgCarHandlingController (class)](#ggcarhandlingcontroller-class)
    - [onSpawned (method)](#onspawned-method)
    - [tickOrder (property)](#tickorder-property)
    - [carHandlingInput (property)](#carhandlinginput-property)
    - [switchingGearsEnabled (property)](#switchinggearsenabled-property)
  - [GgCarHandlingControllerOptions (type alias)](#ggcarhandlingcontrolleroptions-type-alias)

---

# utils

## GgCarHandlingController (class)

**Signature**

```ts
export declare class GgCarHandlingController {
  constructor(
    public readonly keyboard: KeyboardInput,
    public car: GgCarEntity | null,
    public readonly options: GgCarHandlingControllerOptions = {
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
readonly carHandlingInput: CarHandlingController
```

### switchingGearsEnabled (property)

**Signature**

```ts
switchingGearsEnabled: boolean
```

## GgCarHandlingControllerOptions (type alias)

**Signature**

```ts
export type GgCarHandlingControllerOptions = CarHandlingControllerOptions & {
  gearUpDownKeys: [string, string]
  /**
   * Whether the throttle keys pick the driving direction by themselves. While `true`, holding
   * "down" brakes a car moving forward, and once it (nearly) stands still shifts into reverse and
   * swaps the two keys: "down" now accelerates backwards, "up" brakes - until the car stands still
   * again with "up" held, which shifts back into first gear. While `false`, "up" is always the
   * throttle and "down" always the brake, and the direction only changes with the gear keys.
   */
  autoReverse: boolean
  /**
   * Whether `autoReverse` leaves a car in neutral alone. Default `true`: neutral is a gear the
   * driver picks and leaves with the gear keys, and the throttle keys only rev the engine in it.
   * With `false` neutral is never used: any throttle input shifts a car found in neutral (e.g. a
   * freshly spawned one) into first gear or reverse right away, so it drives with the throttle
   * keys alone. Pair it with `switchingGearsEnabled = false`, which turns the gear keys off. Has
   * no effect without `autoReverse`.
   */
  neutralGear?: boolean
  handbrakeKey: string
}
```
