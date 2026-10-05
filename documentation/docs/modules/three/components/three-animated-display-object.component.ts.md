---
title: three/components/three-animated-display-object.component.ts
nav_order: 194
parent: Modules
---

## three-animated-display-object.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ThreeAnimatedDisplayObjectComponent (class)](#threeanimateddisplayobjectcomponent-class)
    - [playAnimation (method)](#playanimation-method)
    - [stopAnimation (method)](#stopanimation-method)
    - [updateAnimations (method)](#updateanimations-method)
    - [clone (method)](#clone-method)
    - [dispose (method)](#dispose-method)

---

# utils

## ThreeAnimatedDisplayObjectComponent (class)

A `ThreeDisplayObjectComponent` whose native mesh carries `AnimationClip`s (loaded via
`ThreeLoader.loadFromGlb` from a `.glb` with non-empty `gltf.animations`) - see
`IAnimatedDisplayObject3dComponent`'s own doc for the contract this implements. Owns a single
`THREE.AnimationMixer` rooted at `nativeMesh` (works whether `nativeMesh` is the loaded model's
own scene root, or a wrapping `Group` one level up - see `ThreeLoader.loadFromGlb`'s `offset`
handling - since `AnimationMixer`/`AnimationClip` tracks address targets by name via
`root.getObjectByName(...)`, found the same way regardless of how many ancestors sit above the
named node).

**Signature**

```ts
export declare class ThreeAnimatedDisplayObjectComponent {
  constructor(nativeMesh: Object3D, clips: AnimationClip[])
}
```

### playAnimation (method)

**Signature**

```ts
public playAnimation(name: string, options: PlayAnimationOptions = {}): void
```

### stopAnimation (method)

**Signature**

```ts
public stopAnimation(fadeDuration: number = 0.2): void
```

### updateAnimations (method)

**Signature**

```ts
public updateAnimations(deltaSeconds: number): void
```

### clone (method)

**Signature**

```ts
clone(): ThreeAnimatedDisplayObjectComponent
```

### dispose (method)

**Signature**

```ts
dispose(): void
```
