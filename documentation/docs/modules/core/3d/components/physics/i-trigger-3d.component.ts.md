---
title: core/3d/components/physics/i-trigger-3d.component.ts
nav_order: 31
parent: Modules
---

## i-trigger-3d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ITrigger3dComponent (interface)](#itrigger3dcomponent-interface)

---

# utils

## ITrigger3dComponent (interface)

**Signature**

```ts
export interface ITrigger3dComponent<PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D>
  extends ITriggerComponent<Point3, Point4, PTypeDoc> {
  /** body info for physics debugger view */
  readonly debugBodySettings: DebugBody3DSettings;
```
