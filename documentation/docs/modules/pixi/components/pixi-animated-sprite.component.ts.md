---
title: pixi/components/pixi-animated-sprite.component.ts
nav_order: 157
parent: Modules
---

## pixi-animated-sprite.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [PixiAnimatedSpriteComponent (class)](#pixianimatedspritecomponent-class)
    - [playAnimation (method)](#playanimation-method)
    - [stopAnimation (method)](#stopanimation-method)
    - [updateAnimations (method)](#updateanimations-method)
    - [clone (method)](#clone-method)
    - [animationNames (property)](#animationnames-property)
  - [PixiAnimationClip (type alias)](#pixianimationclip-type-alias)

---

# utils

## PixiAnimatedSpriteComponent (class)

A pixi.js `AnimatedSprite`-backed display object carrying a named set of atlas-frame clips (e.g.
`idle`/`walk`/`run`/`jump`) - the 2D counterpart of an animated glTF mesh on the 3D side. Built by
`PixiFactory.createAnimatedSprite`, never constructed directly.

`AnimatedSprite.autoUpdate` is always `false` here - this engine drives every tick itself (see
`updateAnimations`), so the sprite is never connected to pixi's own shared `Ticker`. `Ticker.deltaTime`
is the only field `AnimatedSprite.update` actually reads, so `updateAnimations(deltaSeconds)`
synthesizes a throwaway object with just that field (`deltaSeconds * 60`, matching `deltaTime`'s own
"1 == one frame at a 60fps baseline" convention) rather than constructing a real `Ticker`.

**Signature**

```ts
export declare class PixiAnimatedSpriteComponent {
  constructor(sprite: AnimatedSprite, private readonly clips: Record<string, PixiAnimationClip>)
}
```

### playAnimation (method)

**Signature**

```ts
playAnimation(name: string, options: PlayAnimation2dOptions = {}): void
```

### stopAnimation (method)

**Signature**

```ts
stopAnimation(): void
```

### updateAnimations (method)

**Signature**

```ts
updateAnimations(deltaSeconds: number): void
```

### clone (method)

**Signature**

```ts
clone(): PixiAnimatedSpriteComponent
```

### animationNames (property)

**Signature**

```ts
readonly animationNames: string[]
```

## PixiAnimationClip (type alias)

One named clip's frames plus its own playback speed - see `PixiFactory.createAnimatedSprite`.

**Signature**

```ts
export type PixiAnimationClip = {
  frames: AnimatedSprite['textures']
  /** Playback speed, in frames per second. Default 10. */
  fps?: number
}
```
