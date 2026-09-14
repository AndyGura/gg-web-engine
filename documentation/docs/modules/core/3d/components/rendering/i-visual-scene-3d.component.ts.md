---
title: core/3d/components/rendering/i-visual-scene-3d.component.ts
nav_order: 45
parent: Modules
---

## i-visual-scene-3d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IVisualScene3dComponent (interface)](#ivisualscene3dcomponent-interface)

---

# utils

## IVisualScene3dComponent (interface)

**Signature**

```ts
export interface IVisualScene3dComponent<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>
  extends IVisualSceneComponent<Point3, Point4, VTypeDoc> {
  readonly loader: VTypeDoc['loader']

  /**
   * The render layer every display object and every camera in this scene belongs to/renders by
   * default - always `MAIN_RENDER_LAYER` (`0`), exposed here as a scene-level property purely for
   * symmetry with `IPhysicsWorldComponent.mainCollisionGroup` (this one never actually varies by
   * adapter the way `mainCollisionGroup` theoretically could, so reaching for the shared constant
   * directly is equally correct - this property exists so render-layer code can mirror
   * collision-group code's own shape without a special case).
   */
  readonly mainRenderLayer: RenderLayer

  /**
   * Registers and returns a new render layer, analogous to `IPhysicsWorldComponent.registerCollisionGroup`
   * - use this instead of an app-chosen numeric literal so unrelated systems allocating their own
   * layers can never collide with each other. Never returns `MAIN_RENDER_LAYER` (already permanently
   * reserved) or `SELF_VIEW_HIDDEN_RENDER_LAYER` (reserved by `CharacterController3dEntity` - see its
   * own doc).
   */
  registerRenderLayer(): RenderLayer

  /**
   * Deregisters a previously registered render layer (see `registerRenderLayer`), freeing it for
   * reuse. Does **not** itself change any object's/camera's current `enableRenderLayer` state -
   * exactly like `IPhysicsWorldComponent.deregisterCollisionGroup`, a caller that already
   * enabled/disabled this layer somewhere is responsible for undoing that first if it matters
   * (typically moot: the layer is normally deregistered only once nothing references it anymore).
   */
  deregisterRenderLayer(layer: RenderLayer): void
}
```
