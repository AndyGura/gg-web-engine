---
title: core/base/components/rendering/i-visual-scene.component.ts
nav_order: 68
parent: Modules
---

## i-visual-scene.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IVisualSceneComponent (interface)](#ivisualscenecomponent-interface)

---

# utils

## IVisualSceneComponent (interface)

**Signature**

```ts
export interface IVisualSceneComponent<D, R> extends IComponent {
  readonly factory: any // type defined in sub-interfaces

  readonly debugPhysicsDrawerClass?: { new (): IDebugPhysicsDrawer<D, R> }

  init(): Promise<void>
}
```
