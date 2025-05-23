---
title: core/3d/components/physics/i-physics-world-3d.component.ts
nav_order: 28
parent: Modules
---

## i-physics-world-3d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IPhysicsWorld3dComponent (interface)](#iphysicsworld3dcomponent-interface)

---

# utils

## IPhysicsWorld3dComponent (interface)

**Signature**

```ts
export interface IPhysicsWorld3dComponent<PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D>
  extends IPhysicsWorldComponent<Point3, Point4, PTypeDoc> {
  readonly loader: PTypeDoc['loader']

  /** event emitter, emits newly added physics components */
  readonly added$: Subject<PTypeDoc['trigger'] | PTypeDoc['rigidBody'] | PTypeDoc['raycastVehicle'] | any>
  /** event emitter, emits just removed physics components */
  readonly removed$: Subject<PTypeDoc['trigger'] | PTypeDoc['rigidBody'] | PTypeDoc['raycastVehicle'] | any>
  /** list of currently added to world physics components */
  readonly children: (PTypeDoc['trigger'] | PTypeDoc['rigidBody'] | PTypeDoc['raycastVehicle'] | any)[]
}
```
