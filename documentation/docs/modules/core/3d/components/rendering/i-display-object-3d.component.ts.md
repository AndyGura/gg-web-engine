---
title: core/3d/components/rendering/i-display-object-3d.component.ts
nav_order: 43
parent: Modules
---

## i-display-object-3d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IDisplayObject3dComponent (interface)](#idisplayobject3dcomponent-interface)

---

# utils

## IDisplayObject3dComponent (interface)

**Signature**

```ts
export interface IDisplayObject3dComponent<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>
  extends IDisplayObjectComponent<Point3, Point4, VTypeDoc> {
  /**
   * Joins `layer` to this object's own render-layer membership, in addition to whatever it already
   * belongs to (every display object belongs to `MAIN_RENDER_LAYER` alone from construction,
   * mirroring a fresh three.js `Object3D`'s own native default layer) - **and**, since
   * `ICamera3dComponent extends IDisplayObject3dComponent`, the exact same membership concept
   * doubles as "which render layers this camera renders": a camera enabling a layer starts
   * rendering every object that belongs to it, on top of whatever it already rendered.
   *
   * An object is rendered by a given camera iff **any** layer is enabled on both sides - the same
   * "any shared bit" rule `ownCollisionGroups`/`interactWithCollisionGroups` use for collision, see
   * `CollisionGroup`'s own doc. Every camera enables every currently-registered render layer by
   * default (see `ICamera3dComponent`'s own doc) - so registering a new layer and enabling it on
   * one specific object (without touching any camera) already makes that object visible to every
   * *existing* default camera; the camera side of this method only matters for a camera that's been
   * deliberately narrowed with `disableRenderLayer`.
   *
   * **`clone()` copies render-layer membership along with everything else** (three.js's own
   * `Object3D.copy()` copies `.layers.mask` too) - a clone of an object that was narrowed away from
   * `MAIN_RENDER_LAYER` (e.g. a `CharacterController3dEntity`'s own mesh, permanently on
   * `SELF_VIEW_HIDDEN_RENDER_LAYER` instead - see that constant's doc) inherits that same
   * narrowing, and needs `enableRenderLayer(MAIN_RENDER_LAYER)` (or an equivalent explicit reset)
   * called on the clone if it's meant to be ordinarily visible - e.g. a "ghost preview" clone shown
   * in the main scene regardless of where the original is currently tagged.
   */
  enableRenderLayer(layer: RenderLayer): void

  /** Undoes `enableRenderLayer` - removes `layer` from this object's own render-layer membership
   * (or a camera's own rendered layers), leaving every other currently-enabled layer untouched. */
  disableRenderLayer(layer: RenderLayer): void

  /** Whether `layer` is currently one of this object's own render layers (or, for a camera, one of
   * the layers it currently renders) - see `enableRenderLayer`'s own doc. */
  isRenderLayerEnabled(layer: RenderLayer): boolean

  /** Narrows the inherited `IDisplayObjectComponent.clone()`'s return type back to
   * `IDisplayObject3dComponent` (a 3D clone is always itself a 3D display object) - otherwise every
   * existing call site cloning a `IDisplayObject3dComponent` would widen back to the dimension-
   * agnostic base type and lose access to `enableRenderLayer`/`disableRenderLayer`/
   * `isRenderLayerEnabled` on the result, purely because those three methods didn't exist on the
   * base interface's own declared return type. */
  clone(): IDisplayObject3dComponent<VTypeDoc>

  /** Narrows `IDisplayObjectComponent.popChild()`'s return type the same way `clone()` above does,
   * and for the same reason - a child popped off a 3D display object is itself a 3D display object. */
  popChild(name: string): IDisplayObject3dComponent<VTypeDoc> | null
}
```
