---
title: core/base/components/physics/i-body.component.ts
nav_order: 63
parent: Modules
---

## i-body.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IBodyComponent (interface)](#ibodycomponent-interface)

---

# utils

## IBodyComponent (interface)

**Signature**

```ts
export interface IBodyComponent<D, R, TypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>>
  extends IWorldComponent<D, R, VisualTypeDocRepo<D, R>, TypeDoc> {
  entity: IEntity | null;

  position: D;
  rotation: R;

  name: string;
```