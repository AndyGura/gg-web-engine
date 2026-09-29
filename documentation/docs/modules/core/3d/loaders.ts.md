---
title: core/3d/loaders.ts
nav_order: 83
parent: Modules
---

## loaders overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IDisplayObject3dComponentLoader (interface)](#idisplayobject3dcomponentloader-interface)
  - [IPhysicsBody3dComponentLoader (class)](#iphysicsbody3dcomponentloader-class)
    - [loadFromGgGlb (method)](#loadfromggglb-method)
  - [LoadGlbOptions (interface)](#loadglboptions-interface)

---

# utils

## IDisplayObject3dComponentLoader (interface)

**Signature**

```ts
export interface IDisplayObject3dComponentLoader<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D> {
  loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<VTypeDoc['displayObject'] | null>

  /**
   * Loads a plain `.glb` file - no paired `.meta` (see `loadFromGgGlb`), no physics bodies, just
   * the visual mesh - and its animation clips, if it has any. Returns a display object
   * implementing {@link IAnimatedDisplayObject3dComponent} (checkable via
   * `isAnimatedDisplayObject3d`) when the file's own animations are non-empty, otherwise an
   * ordinary one, same as any other loaded model. The generic entry point for any visual-only
   * asset (a character model, a prop with no physics representation of its own, ...) that doesn't
   * need the GG meta/physics-body pipeline `loadFromGgGlb` provides.
   */
  loadFromGlb(glbFile: ArrayBuffer, options?: LoadGlbOptions): Promise<VTypeDoc['displayObject'] | null>
}
```

## IPhysicsBody3dComponentLoader (class)

**Signature**

```ts
export declare class IPhysicsBody3dComponentLoader<PTypeDoc> {
  protected constructor(protected readonly world: IPhysicsWorld3dComponent)
}
```

### loadFromGgGlb (method)

**Signature**

```ts
async loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<PTypeDoc['rigidBody'][]>
```

## LoadGlbOptions (interface)

Options for {@link IDisplayObject3dComponentLoader.loadFromGlb}.

**Signature**

```ts
export interface LoadGlbOptions {
  /**
   * Local offset applied to the loaded model, independent of whatever world position/rotation the
   * returned display object is subsequently moved to (e.g. by `Entity3d`/`CharacterController3dEntity`
   * syncing it from a driving body every tick, which otherwise overwrites the object's position
   * outright rather than composing with it). Mainly for a model authored with its origin somewhere
   * other than the point that should track the entity's own position - e.g. a character rig
   * authored with its origin at the feet, offset to align with a `CharacterController3dEntity`
   * capsule's center. Left unset, the loaded model's own authored origin is used as-is.
   */
  offset?: Point3
}
```
