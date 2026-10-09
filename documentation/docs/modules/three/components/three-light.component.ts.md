---
title: three/components/three-light.component.ts
nav_order: 217
parent: Modules
---

## three-light.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ThreeLightComponent (class)](#threelightcomponent-class)
    - [create (static method)](#create-static-method)
    - [applyShadowOpts (static method)](#applyshadowopts-static-method)
    - [clone (method)](#clone-method)
    - [dispose (method)](#dispose-method)
    - [lightType (property)](#lighttype-property)

---

# utils

## ThreeLightComponent (class)

three.js implementation of `ILight3dComponent`. `nativeLight` is the underlying `THREE.Light`.

Directional and spot lights get their `target` as a child placed one unit along local `-Z`, so
they shine wherever the component's rotation points them (three.js otherwise aims them at a
separate target object sitting at the world origin). A hemisphere light takes its sky direction
from its own position in three.js, so for that type the position setter is ignored and the
native position is kept at the rotated `+Z` unit vector instead.

**Signature**

```ts
export declare class ThreeLightComponent {
  constructor(public readonly nativeLight: Light, descriptor: Light3dDescriptor)
}
```

### create (static method)

**Signature**

```ts
static create(descriptor: Light3dDescriptor): ThreeLightComponent
```

### applyShadowOpts (static method)

**Signature**

```ts
private static applyShadowOpts(shadow: LightShadow, opts: Light3dShadowOpts): void
```

### clone (method)

**Signature**

```ts
clone(): ThreeLightComponent
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### lightType (property)

**Signature**

```ts
readonly lightType: "AMBIENT" | "HEMISPHERE" | "DIRECTIONAL" | "POINT" | "SPOT"
```
