---
title: pixi/pixi-factory.ts
nav_order: 192
parent: Modules
---

## pixi-factory overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [PixiDisplayObject3dOpts (type alias)](#pixidisplayobject3dopts-type-alias)
  - [PixiFactory (class)](#pixifactory-class)
    - [createPrimitive (method)](#createprimitive-method)
    - [paint (method)](#paint-method)
    - [texturedSprite (method)](#texturedsprite-method)
    - [createNativePrimitive (method)](#createnativeprimitive-method)
    - [createAnimatedSprite (method)](#createanimatedsprite-method)
    - [createParallaxLayer (method)](#createparallaxlayer-method)
    - [loadTexture (method)](#loadtexture-method)
    - [textureFromData (method)](#texturefromdata-method)
    - [decodeSvg (method)](#decodesvg-method)
    - [disposeTexture (method)](#disposetexture-method)
    - [prepare (method)](#prepare-method)
    - [createTextureFromCanvas (method)](#createtexturefromcanvas-method)
    - [createCamera (method)](#createcamera-method)
    - [createText (method)](#createtext-method)
    - [applyTextureOptions (method)](#applytextureoptions-method)
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
export declare class PixiFactory {
  constructor(private readonly scene?: PixiSceneComponent)
}
```

### createPrimitive (method)

**Signature**

```ts
createPrimitive(descriptor: Shape2DDescriptor, material: PixiDisplayObject3dOpts = {}): PixiDisplayObjectComponent
```

### paint (method)

Fills an untextured shape's path with `material.color` and outlines it with `material.stroke`.

**Signature**

```ts
private paint(graphics: Graphics, material: PixiDisplayObject3dOpts): Graphics
```

### texturedSprite (method)

A sprite showing `texture`, centered on its position, tinted with `material.color` if set.

**Signature**

```ts
private texturedSprite(texture: Texture, width: number, height: number, material: PixiDisplayObject3dOpts): Sprite
```

### createNativePrimitive (method)

**Signature**

```ts
private createNativePrimitive(descriptor: Shape2DDescriptor, material: PixiDisplayObject3dOpts): Container
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

### createParallaxLayer (method)

**Signature**

```ts
createParallaxLayer(options: ParallaxLayer2dOpts<Texture>): PixiParallaxLayerComponent
```

### loadTexture (method)

**Signature**

```ts
async loadTexture(url: string, options: TextureOptions = {}): Promise<Texture>
```

### textureFromData (method)

Decodes an already-fetched image file into a texture of its own: unlike `loadTexture`, nothing
goes through pixi's global `Assets` cache, so the texture belongs to whoever asked for it and
is freed with `disposeTexture`.

**Signature**

```ts
async textureFromData(data: Blob, options: TextureOptions = {}): Promise<Texture>
```

### decodeSvg (method)

**Signature**

```ts
private async decodeSvg(data: Blob): Promise<HTMLImageElement>
```

### disposeTexture (method)

Frees a texture made by `textureFromData`, together with its image.

**Signature**

```ts
disposeTexture(texture: Texture): void
```

### prepare (method)

Uploads a texture to the GPU on every renderer drawing the scene, instead of on the first
frame it is visible in. A renderer that is not initialized yet is skipped.

**Signature**

```ts
async prepare(texture: Texture): Promise<void>
```

### createTextureFromCanvas (method)

**Signature**

```ts
createTextureFromCanvas(canvas: HTMLCanvasElement, options: TextureOptions = {}): Texture
```

### createCamera (method)

**Signature**

```ts
createCamera(): PixiCameraComponent
```

### createText (method)

**Signature**

```ts
createText(text: string, style: Text2dStyle = {}): PixiTextComponent
```

### applyTextureOptions (method)

**Signature**

```ts
private applyTextureOptions(texture: Texture, options: TextureOptions): Texture
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
