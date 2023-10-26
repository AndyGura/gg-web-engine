---
title: core/base/components/physics/i-physics-world.component.ts
nav_order: 60
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

**Signature**

```ts
export interface IPhysicsWorldComponent<D, R> extends IComponent {
  readonly factory: any; // type defined in sub-interfaces
  gravity: D;
  timeScale: number;
```
