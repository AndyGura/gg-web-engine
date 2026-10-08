---
title: core/base/components/physics/i-physics-world.component.ts
nav_order: 117
parent: Modules
---

## i-physics-world.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IPhysicsWorldComponent (interface)](#iphysicsworldcomponent-interface)

---

# utils

## IPhysicsWorldComponent (interface)

Interface representing a physics world component.

**Signature**

```ts
export interface IPhysicsWorldComponent<D, R, PTypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>>
  extends IComponent {
  /**
   * Short, stable name of the physics library behind this world (`'ammo'`, `'rapier3d'`,
   * `'rapier2d'`, `'matter'`, ...), the same for every instance of an adapter. Shown in the dev
   * console's world info and handy in logs or bug reports.
   */
  readonly backendName: string

  /**
   * Factory function for creating physics-related objects.
   */
  readonly factory: PTypeDoc['factory']

  /**
   * The gravity vector affecting the physics world.
   */
  gravity: D

  /**
   * Event emitter that emits newly added physics components.
   */
  readonly added$: Subject<PTypeDoc['rigidBody'] | PTypeDoc['trigger'] | any>

  /**
   * Event emitter that emits just removed physics components.
   */
  readonly removed$: Subject<PTypeDoc['rigidBody'] | PTypeDoc['trigger'] | any>

  /**
   * List of currently added physics components in the world.
   */
  readonly children: (PTypeDoc['rigidBody'] | PTypeDoc['trigger'] | any)[]

  /**
   * The main collision group. All physics bodies have this collision group set by default.
   */
  readonly mainCollisionGroup: CollisionGroup

  /**
   * The longest single native step `simulate()` takes, in seconds: a call is split into as many
   * equal steps as it needs to keep each one this short (bounded by `maxSubSteps`). `undefined` or
   * `0` steps at most 1/60 s at a time. Only adapters that split a call into substeps have it
   * (Ammo, Rapier 3D); on the others setting it does nothing.
   */
  fixedTimeStep?: number

  /**
   * The most substeps one `simulate()` call runs, however long its delta - a huge catch-up delta
   * then takes longer steps instead of grinding through a great many. `0`/`undefined` means no cap.
   * See `fixedTimeStep` for which adapters have it.
   */
  maxSubSteps?: number

  /**
   * Initializes the physics world component.
   *
   * @returns A promise that resolves when initialization is complete.
   */
  init(): Promise<void>

  /**
   * Runs the simulation of the physics world for the given time step.
   *
   * `GgWorld` may call this once per rendered frame with that frame's own (variable) delta - the
   * original, still-default behavior - but when its `fixedPhysicsStep` option is set it instead
   * calls this zero, one, or several times within a single frame, every time with the exact same
   * constant `delta` value (an accumulator batches the frame's real elapsed time into fixed-size
   * steps - see `GgWorld`'s constructor doc). An implementation must not assume `simulate` is
   * called at most once per rendered frame, or that consecutive calls are spaced apart by whatever
   * time actually elapsed on the wall clock - any per-call bookkeeping keyed on real elapsed time
   * (rather than purely on `delta`) will be wrong under a fixed step.
   *
   * @param delta - The time step in milliseconds since the last update.
   */
  simulate(delta: number): void

  /**
   * Registers and returns a new collision group.
   *
   * @returns A newly registered collision group.
   */
  registerCollisionGroup(): CollisionGroup

  /**
   * Deregisters a previously registered collision group.
   *
   * @param group - The collision group to be removed.
   */
  deregisterCollisionGroup(group: CollisionGroup): void

  /**
   * Performs a raycast in the physics world.
   *
   * @param options - The options for the raycast.
   * @returns The result of the raycast.
   */
  raycast(options: RaycastOptions<D>): RaycastResult<D, PTypeDoc['rigidBody'] | PTypeDoc['trigger']>
}
```
