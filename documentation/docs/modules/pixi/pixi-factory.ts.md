---
title: pixi/pixi-factory.ts
nav_order: 164
parent: Modules
---

## pixi-factory overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [PixiDisplayObject3dOpts (type alias)](#pixidisplayobject3dopts-type-alias)
  - [PixiFactory (class)](#pixifactory-class)
    - [createPrimitive (method)](#createprimitive-method)
    - [createAnimatedSprite (method)](#createanimatedsprite-method)
  - [PixiGridAtlasClip (type alias)](#pixigridatlasclip-type-alias)
  - [PixiGridAtlasOptions (type alias)](#pixigridatlasoptions-type-alias)

---

# utils

## PixiDisplayObject3dOpts (type alias)

**Signature**

```ts
export type PixiDisplayObject3dOpts = DisplayObject2dOpts<Texture>
```

## PixiFactory (class)

**Signature**

```ts
export declare class PixiFactory
```

### createPrimitive (method)

**Signature**

```ts
createPrimitive(descriptor: Shape2DDescriptor, material: PixiDisplayObject3dOpts = {}): PixiDisplayObjectComponent
```

### createAnimatedSprite (method)

Builds an animated sprite from a texture laid out as a uniform grid atlas (see
`PixiGridAtlasOptions`) - the entry point for a character sprite with named clips (idle/walk/
run/jump, ...). Slices each clip's own row into `frameCount` individual frame textures sharing
`baseTexture`'s source (no copying/re-encoding, just distinct `frame` rectangles).

**Signature**

```ts
createAnimatedSprite(baseTexture: Texture, options: PixiGridAtlasOptions): PixiAnimatedSpriteComponent
```

## PixiGridAtlasClip (type alias)

A single named clip's location within a uniform-grid atlas - see `PixiGridAtlasOptions`.

**Signature**

```ts
export type PixiGridAtlasClip = {
  /** Row index (0-based) within the grid this clip's frames live on. */
  row: number
  /** Number of consecutive frames (columns), starting at column 0, this clip uses. */
  frameCount: number
  /** Playback speed, in frames per second. Default 10. */
  fps?: number
}
```

## PixiGridAtlasOptions (type alias)

Describes a texture atlas laid out as a uniform grid of equally-sized frames (the common case for
a hand-authored pixel-art character sheet) - one row per animation clip, `frameCount` consecutive
columns per clip starting at column 0. See `PixiFactory.createAnimatedSprite`.

**Signature**

```ts
export type PixiGridAtlasOptions = {
  /** Width, in pixels, of a single frame cell. */
  frameWidth: number
  /** Height, in pixels, of a single frame cell. */
  frameHeight: number
  /** Named clips, keyed the same way `CharacterAnimation2dClipMap`/`CharacterAnimation2dState` expect
   * (e.g. `idle`/`walk`/`run`/`jump`) - any name is accepted, `IAnimatedDisplayObject2dComponent.animationNames`
   * just reflects whatever keys are given here. */
  clips: Record<string, PixiGridAtlasClip>
}
```
