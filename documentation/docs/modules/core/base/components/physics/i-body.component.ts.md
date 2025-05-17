---
title: core/base/components/physics/i-body.component.ts
nav_order: 64
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
export interface IBodyComponent<D, R, PTypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>>
  extends IWorldComponent<D, R, GgWorldTypeDocPPatch<D, R, PTypeDoc>> {
  entity: IEntity | null;

  position: D;
  rotation: R;

  name: string;
```
