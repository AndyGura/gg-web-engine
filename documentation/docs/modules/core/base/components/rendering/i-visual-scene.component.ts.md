---
title: core/base/components/rendering/i-visual-scene.component.ts
nav_order: 70
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
export interface IVisualSceneComponent<D, R, TypeDoc extends VisualTypeDocRepo<D, R> = VisualTypeDocRepo<D, R>>
  extends IComponent {
  readonly factory: TypeDoc['factory']

  init(): Promise<void>
}
```
