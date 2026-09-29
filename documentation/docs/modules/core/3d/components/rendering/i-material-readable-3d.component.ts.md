---
title: core/3d/components/rendering/i-material-readable-3d.component.ts
nav_order: 52
parent: Modules
---

## i-material-readable-3d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IMaterialReadable3dComponent (interface)](#imaterialreadable3dcomponent-interface)
  - [isMaterialReadable3d](#ismaterialreadable3d)

---

# utils

## IMaterialReadable3dComponent (interface)

A 3D display object that remembers the `DisplayObject3dOpts` it was actually built with (color/
shading/texture/shadow flags) - e.g. one of `IDisplayObject3dComponentFactory.createPrimitive`'s
own outputs (and therefore every `createBox`/`createSphere`/... shortcut built on it), as opposed
to a loaded `.glb` model, whose materials come from the asset file rather than a
`DisplayObject3dOpts`, and never implements this. Optional/adapter-specific on purpose, the same
reason `IAnimatedDisplayObject3dComponent` is separate from the base display-object contract -
check with {@link isMaterialReadable3d} before reading {@link materialOptions}.

This is what lets `Gg3dLevelLoader`'s `"Primitive"` live serializer (and `GgCarEntity`'s own
`ISerializableEntity.serializeSettings`, for its chassis/wheel meshes) recover a `material` field
for its `EntityJson`, rather than always reloading with a fresh, unrelated auto-generated color.

**Signature**

```ts
export interface IMaterialReadable3dComponent<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>
  extends IDisplayObject3dComponent<VTypeDoc> {
  /** The options this display object was actually constructed with - not necessarily what a caller
   * passed in verbatim (a factory may resolve/default fields, e.g. a random color when none was
   * given), but exactly what would reproduce this object's current appearance if passed back into
   * the same factory call that made it. */
  readonly materialOptions: DisplayObject3dOpts<VTypeDoc['texture']>
}
```

## isMaterialReadable3d

Type guard for {@link IMaterialReadable3dComponent} - checks for the field that distinguishes a
material-readable display object from an ordinary one. Prefer this over an `instanceof` check
against any concrete adapter class, which would defeat the point of the `TypeDoc`-generic,
library-agnostic interfaces the rest of `packages/core` is built around.

**Signature**

```ts
export declare function isMaterialReadable3d<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>(
  displayObject: VTypeDoc['displayObject'] | null | undefined
): displayObject is IMaterialReadable3dComponent<VTypeDoc>
```
