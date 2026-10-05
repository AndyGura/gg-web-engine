---
title: core/3d/components/rendering/i-light-3d.component.ts
nav_order: 56
parent: Modules
---

## i-light-3d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ILight3dComponent (interface)](#ilight3dcomponent-interface)

---

# utils

## ILight3dComponent (interface)

A light in the visual scene, created by `IDisplayObject3dComponentFactory.createLight`. It is a
display object, so it has a position/rotation of its own and is added to a world the same way a
mesh is (usually wrapped in a `Light3dEntity`). Which of position and rotation matter depends on
{@link lightType} - see each `Light3dDescriptor` member's own doc. Directional and spot lights
shine along their local `-Z` axis, the same direction a camera with the same rotation looks.

**Signature**

```ts
export interface ILight3dComponent<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>
  extends IDisplayObject3dComponent<VTypeDoc> {
  readonly lightType: Light3dType

  /** RGB color as a `0xRRGGBB` number. */
  color: number

  /** Brightness multiplier. */
  intensity: number

  /** Whether this light casts shadows. Always `false` (and a no-op to set) for `AMBIENT`/`HEMISPHERE`. */
  castShadow: boolean

  /**
   * The light's current settings as a complete descriptor - passing it back to `createLight`
   * reproduces an equivalent light. Reflects later changes to {@link color}/{@link intensity}/
   * {@link castShadow}.
   */
  readonly lightOptions: Light3dDescriptor

  /** Narrows `IDisplayObject3dComponent.clone()`'s return type: a cloned light is still a light. */
  clone(): ILight3dComponent<VTypeDoc>
}
```
