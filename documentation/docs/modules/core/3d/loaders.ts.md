---
title: core/3d/loaders.ts
nav_order: 96
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

  /**
   * Loads an image as a texture, e.g. for `DisplayObject3dOpts.diffuse`, or, with
   * `{ mapping: 'equirectangular' }`, a panorama for `IVisualScene3dComponent.setEnvironment`.
   */
  loadTexture(url: string, options?: LoadTextureOptions): Promise<VTypeDoc['texture']>

  /**
   * Loads a six-image cube-map sky for `IVisualScene3dComponent.setEnvironment`'s `background`/
   * `environmentMap`. Each face is named after the world direction it is seen in (see
   * `CubeTextureFaces`).
   */
  loadCubeTexture(faces: CubeTextureFaces): Promise<VTypeDoc['texture']>

  /**
   * Decodes a texture from an already-fetched image file - what `loadTexture` does after its own
   * fetch. `world.loader.loadTexture` fetches the file itself (reporting progress, cancellable) and
   * hands it over here; `options.url` is where it came from, for telling the format by extension.
   * A loader without this method has its `loadTexture` called instead, and the fetch then goes
   * unreported.
   */
  textureFromData?(data: Blob, options?: LoadTextureOptions & { url?: string }): Promise<VTypeDoc['texture']>

  /** The `loadCubeTexture` counterpart of `textureFromData`: one already-fetched image per face. */
  cubeTextureFromData?(faces: Record<keyof CubeTextureFaces, Blob>): Promise<VTypeDoc['texture']>

  /**
   * Finishes whatever of a loaded texture or display object would otherwise happen at its first
   * render (GPU upload, shader compilation), so `world.loader` can count it as part of the load.
   * Resolves at once when there is nothing to do it with yet (no renderer in the scene).
   */
  prepare?(resource: VTypeDoc['texture'] | VTypeDoc['displayObject']): Promise<void>

  /**
   * Frees a texture returned by `loadTexture`/`loadCubeTexture`. Call it once nothing uses the
   * texture anymore (no scene environment, no material).
   */
  disposeTexture(texture: VTypeDoc['texture']): void
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
