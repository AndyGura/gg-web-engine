---
title: core/3d/models/lights.ts
nav_order: 95
parent: Modules
---

## lights overview

Shadow-casting settings for a light that supports shadows (`DIRECTIONAL`, `POINT`, `SPOT`). Every
field is optional; an omitted field keeps the adapter's own default.

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AmbientLight3dDescriptor (type alias)](#ambientlight3ddescriptor-type-alias)
  - [DirectionalLight3dDescriptor (type alias)](#directionallight3ddescriptor-type-alias)
  - [HemisphereLight3dDescriptor (type alias)](#hemispherelight3ddescriptor-type-alias)
  - [Light3dDescriptor (type alias)](#light3ddescriptor-type-alias)
  - [Light3dShadowOpts (type alias)](#light3dshadowopts-type-alias)
  - [Light3dType (type alias)](#light3dtype-type-alias)
  - [PointLight3dDescriptor (type alias)](#pointlight3ddescriptor-type-alias)
  - [SpotLight3dDescriptor (type alias)](#spotlight3ddescriptor-type-alias)

---

# utils

## AmbientLight3dDescriptor (type alias)

Uniform light hitting every surface equally from every direction. Position/rotation are ignored.

**Signature**

```ts
export type AmbientLight3dDescriptor = Light3dBaseDescriptor & { type: 'AMBIENT' }
```

## DirectionalLight3dDescriptor (type alias)

Parallel rays, like the sun. The light shines along its own local `-Z` axis - the same direction
a camera with the same rotation looks - so `Qtrn.lookAt(lightPosition, target)` aims it at
`target`. At identity rotation it shines straight down. Position only matters for where the
shadow area (`shadow.area`) is centered.

**Signature**

```ts
export type DirectionalLight3dDescriptor = ShadowCastingLight3dDescriptor & { type: 'DIRECTIONAL' }
```

## HemisphereLight3dDescriptor (type alias)

Ambient light that fades from `color` (the sky, coming from the light's local `+Z`, i.e. world up
at identity rotation) to `groundColor` (coming from below). Position is ignored.

**Signature**

```ts
export type HemisphereLight3dDescriptor = Light3dBaseDescriptor & {
  type: 'HEMISPHERE'
  /** Color lighting surfaces facing down. Default `0x444444`. */
  groundColor?: number
}
```

## Light3dDescriptor (type alias)

Describes a light for `IDisplayObject3dComponentFactory.createLight`.

**Signature**

```ts
export type Light3dDescriptor =
  | AmbientLight3dDescriptor
  | HemisphereLight3dDescriptor
  | DirectionalLight3dDescriptor
  | PointLight3dDescriptor
  | SpotLight3dDescriptor
```

## Light3dShadowOpts (type alias)

Shadow-casting settings for a light that supports shadows (`DIRECTIONAL`, `POINT`, `SPOT`). Every
field is optional; an omitted field keeps the adapter's own default.

**Signature**

```ts
export type Light3dShadowOpts = {
  /** Shadow map resolution in texels, per side (e.g. `1024`, `2048`, `4096`). */
  mapSize?: number
  /** Near plane of the shadow camera, in world units. */
  near?: number
  /** Far plane of the shadow camera, in world units. */
  far?: number
  /**
   * `DIRECTIONAL` only: half-size of the square area (perpendicular to the light direction, centered
   * on the light's own position) that receives shadows. Larger areas cover more of the level at a
   * lower effective resolution.
   */
  area?: number
  /** Depth bias, for fighting shadow acne. Usually a tiny negative number, e.g. `-0.0005`. */
  bias?: number
  /** Bias applied along the surface normal, for fighting shadow acne on sloped surfaces. */
  normalBias?: number
}
```

## Light3dType (type alias)

**Signature**

```ts
export type Light3dType = Light3dDescriptor['type']
```

## PointLight3dDescriptor (type alias)

Light emitted from a single point in every direction, like a bulb. Rotation is ignored.

**Signature**

```ts
export type PointLight3dDescriptor = ShadowCastingLight3dDescriptor & {
  type: 'POINT'
  /** Distance at which the light's contribution reaches zero. `0` means unlimited. Default `0`. */
  distance?: number
  /** How fast the light dims with distance. `2` is physically correct. Default `2`. */
  decay?: number
}
```

## SpotLight3dDescriptor (type alias)

A cone of light from a point, like a flashlight. Points along its own local `-Z` axis, the same
convention as `DIRECTIONAL`.

**Signature**

```ts
export type SpotLight3dDescriptor = ShadowCastingLight3dDescriptor & {
  type: 'SPOT'
  /** Distance at which the light's contribution reaches zero. `0` means unlimited. Default `0`. */
  distance?: number
  /** How fast the light dims with distance. `2` is physically correct. Default `2`. */
  decay?: number
  /** Half-angle of the cone, in radians. Default `Math.PI / 3`. */
  angle?: number
  /** Fraction of the cone (`0..1`) over which the edge softens. Default `0`. */
  penumbra?: number
}
```
