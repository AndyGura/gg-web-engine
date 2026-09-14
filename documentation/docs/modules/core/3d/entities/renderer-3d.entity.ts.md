---
title: core/3d/entities/renderer-3d.entity.ts
nav_order: 64
parent: Modules
---

## renderer-3d.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Renderer3dEntity (class)](#renderer3dentity-class)
    - [enableRenderLayer (method)](#enablerenderlayer-method)
    - [disableRenderLayer (method)](#disablerenderlayer-method)
    - [isRenderLayerEnabled (method)](#isrenderlayerenabled-method)

---

# utils

## Renderer3dEntity (class)

**Signature**

```ts
export declare class Renderer3dEntity<VTypeDoc>
```

### enableRenderLayer (method)

Proxies to `this.camera.enableRenderLayer`/`disableRenderLayer`/`isRenderLayerEnabled` - see
`ICamera3dComponent`'s own doc for what enabling/disabling a render layer on a camera means.
Mirrors the inherited `position`/`rotation` accessors (`IRendererEntity`), which proxy to the
same underlying `camera` for the same reason: call sites driving a renderer/its camera (e.g.
`PlayerCharacterController`) shouldn't need to reach through `this.camera.camera` just because
this one concept doesn't already have its own top-level accessor the way position/rotation do.

**Signature**

```ts
enableRenderLayer(layer: RenderLayer): void
```

### disableRenderLayer (method)

See `enableRenderLayer`'s own doc.

**Signature**

```ts
disableRenderLayer(layer: RenderLayer): void
```

### isRenderLayerEnabled (method)

See `enableRenderLayer`'s own doc.

**Signature**

```ts
isRenderLayerEnabled(layer: RenderLayer): boolean
```
