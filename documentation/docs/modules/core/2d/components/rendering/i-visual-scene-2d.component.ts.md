---
title: core/2d/components/rendering/i-visual-scene-2d.component.ts
nav_order: 25
parent: Modules
---

## i-visual-scene-2d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IVisualScene2dComponent (interface)](#ivisualscene2dcomponent-interface)

---

# utils

## IVisualScene2dComponent (interface)

**Signature**

```ts
export interface IVisualScene2dComponent<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D>
  extends IVisualSceneComponent<Point2, number, VTypeDoc> {
  /** The scene's current environment. A fresh scene's `background` is `null`, so the renderer's
   * own clear color shows. */
  readonly environment: Readonly<Environment2dOpts<VTypeDoc['texture']>>

  /** Changes the scene's environment. Only the fields present change; `null` clears a field. */
  setEnvironment(environment: Partial<Environment2dOpts<VTypeDoc['texture']>>): void
}
```
