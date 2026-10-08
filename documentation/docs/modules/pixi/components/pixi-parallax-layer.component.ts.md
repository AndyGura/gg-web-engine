---
title: pixi/components/pixi-parallax-layer.component.ts
nav_order: 186
parent: Modules
---

## pixi-parallax-layer.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [PixiParallaxLayerComponent (class)](#pixiparallaxlayercomponent-class)
    - [updateView (method)](#updateview-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [clone (method)](#clone-method)
    - [dispose (method)](#dispose-method)
    - [nativeSprite (property)](#nativesprite-property)

---

# utils

## PixiParallaxLayerComponent (class)

pixi.js implementation of `IParallaxLayer2dComponent`: a `TilingSprite` living in the scene's
world container (so it sorts by `zIndex` against everything else), resized and re-offset by each
renderer, right before it draws, to cover that renderer's view. The engine never moves it through
`position`; use `offset` instead.

**Signature**

```ts
export declare class PixiParallaxLayerComponent {
  constructor(options: ParallaxLayer2dOpts<Texture>)
}
```

### updateView (method)

Places the layer for one view: `center` is the camera position, `halfExtent` half the size of
the world-space area the view can show (already accounting for zoom and rotation).

**Signature**

```ts
public updateView(center: Point2, halfExtent: Point2): void
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: PixiGgWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: PixiGgWorld, dispose?: boolean): void
```

### clone (method)

**Signature**

```ts
clone(): PixiParallaxLayerComponent
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### nativeSprite (property)

**Signature**

```ts
readonly nativeSprite: TilingSprite
```
