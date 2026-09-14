---
title: core/3d/components/rendering/i-camera-3d.component.ts
nav_order: 42
parent: Modules
---

## i-camera-3d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ICamera3dComponent (interface)](#icamera3dcomponent-interface)

---

# utils

## ICamera3dComponent (interface)

A camera is itself a display object (`IDisplayObject3dComponent`) with a position/rotation of its
own, so `enableRenderLayer`/`disableRenderLayer`/`isRenderLayerEnabled` are inherited rather than
redeclared here - on a camera they mean "which render layers this camera renders" instead of
"which render layers this object belongs to", see that interface's own doc. **A freshly-created
camera renders every currently-registered render layer** (an adapter's own camera-construction
code is expected to enable every layer up front, not just `MAIN_RENDER_LAYER` alone the way a
freshly-created non-camera display object does) - so an app placing a second camera in the scene
(a portal's own "looking through" render pass, a third-person spectator view, ...) never has to
remember to opt it into layers some other, unrelated system registered; only a camera that
deliberately needs to see _less_ than everything (e.g. `PlayerCharacterController`'s own
first-person camera excluding `SELF_VIEW_HIDDEN_RENDER_LAYER`) ever calls `disableRenderLayer`.

**Signature**

```ts
export interface ICamera3dComponent<
  VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D,
> extends IDisplayObject3dComponent<VTypeDoc> {
```
