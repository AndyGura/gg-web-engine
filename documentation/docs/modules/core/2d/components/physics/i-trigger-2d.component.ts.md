---
title: core/2d/components/physics/i-trigger-2d.component.ts
nav_order: 13
parent: Modules
---

## i-trigger-2d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ITrigger2dComponent (interface)](#itrigger2dcomponent-interface)

---

# utils

## ITrigger2dComponent (interface)

**Signature**

```ts
export interface ITrigger2dComponent<TypeDoc extends PhysicsTypeDocRepo2D = PhysicsTypeDocRepo2D>
  extends ITriggerComponent<Point2, number, TypeDoc> {
  /** body info for physics debugger view */
  readonly debugBodySettings: DebugBody2DSettings;
```
