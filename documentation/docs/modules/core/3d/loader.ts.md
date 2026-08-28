---
title: core/3d/loader.ts
nav_order: 59
parent: Modules
---

## loader overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg3dLoader (class)](#gg3dloader-class)
    - [loadGgGlbFiles (method)](#loadggglbfiles-method)
    - [loadGgGlbResources (method)](#loadggglbresources-method)
    - [loadGgGlb (method)](#loadggglb-method)
    - [filesCache (property)](#filescache-property)
    - [loadResultCache (property)](#loadresultcache-property)
  - [Glb3DSettings (interface)](#glb3dsettings-interface)
  - [LoadOptions (type alias)](#loadoptions-type-alias)
  - [LoadResourcesResult (type alias)](#loadresourcesresult-type-alias)
  - [LoadResult (type alias)](#loadresult-type-alias)
  - [LoadResultWithProps (type alias)](#loadresultwithprops-type-alias)

---

# utils

## Gg3dLoader (class)

Full 3D loader exposed as `Gg3dWorld.loader`: GLB+meta asset loading (`loadGgGlb` and friends)
layered on top of `Gg3dLevelLoader`, so `registerClass`/`loadLevel`/`loadLevelFromUrl`/
`getEntityByName` are all available directly on `world.loader`. Also registers a `"Glb"` level
entity class (see `Glb3DSettings`) so a level JSON can place a GLB model declaratively, the same
way it places primitives/triggers/cameras.

**Signature**

```ts
export declare class Gg3dLoader<TypeDoc> {
  constructor(world: Gg3dWorld<TypeDoc>)
}
```

### loadGgGlbFiles (method)

**Signature**

```ts
public async loadGgGlbFiles(path: string, useCache: boolean = false): Promise<[ArrayBuffer, GgMeta]>
```

### loadGgGlbResources (method)

**Signature**

```ts
public async loadGgGlbResources(
    path: string,
    cachingStrategy: CachingStrategy = CachingStrategy.Nothing,
  ): Promise<LoadResourcesResult<TypeDoc>>
```

### loadGgGlb (method)

**Signature**

```ts
public async loadGgGlb(
    path: string,
    options: Partial<LoadOptions> = defaultLoadOptions,
  ): Promise<LoadResultWithProps<TypeDoc>>
```

### filesCache (property)

**Signature**

```ts
readonly filesCache: any
```

### loadResultCache (property)

**Signature**

```ts
readonly loadResultCache: any
```

## Glb3DSettings (interface)

Settings for the built-in `"Glb"` level entity class (3D only): loads a GG GLB+meta pair via
`Gg3dLoader.loadGgGlb` and returns every entity it produces (the model itself, plus any nested
props/scenes) grouped under one `GroupEntity`.

**Signature**

```ts
export interface Glb3DSettings {
  /**
   * Path (URL or path prefix, without extension) to the `.glb`/`.meta` pair - passed straight
   * through to `loadGgGlb`
   */
  path: string

  /**
   * Position of the loaded model
   */
  position?: Point3

  /**
   * Rotation of the loaded model
   */
  rotation?: Point4

  /**
   * Caching strategy, see `CachingStrategy`. Defaults to `CachingStrategy.Nothing`, same as
   * `loadGgGlb` itself.
   */
  cachingStrategy?: CachingStrategy

  /**
   * Whether to also load dummies flagged as props/scenes. Defaults to `true`, same as `loadGgGlb`.
   */
  loadProps?: boolean

  /**
   * Path where to find prop scenes, if different from `path`'s own directory
   */
  propsPath?: string
}
```

## LoadOptions (type alias)

**Signature**

```ts
export type LoadOptions = {
  // whether to cache anything
  // "Nothing" does not cache anything
  // "Files" caches GLB+Meta file contents
  // "Entities" clones and saves parsed from GLB+Meta objects and bodies
  cachingStrategy: CachingStrategy
  // initial position
  position: Point3
  // initial rotation
  rotation: Point4
  // process dummies with flag is_prop
  loadProps: boolean
  // path where to find prop scenes
  propsPath?: string
}
```

## LoadResourcesResult (type alias)

**Signature**

```ts
export type LoadResourcesResult<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> = {
  resources: { object3D: TypeDoc['vTypeDoc']['displayObject'] | null; body: TypeDoc['pTypeDoc']['rigidBody'] | null }[]
  meta: GgMeta
}
```

## LoadResult (type alias)

**Signature**

```ts
export type LoadResult<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> = {
  entities: Entity3d<TypeDoc>[]
  meta: GgMeta
}
```

## LoadResultWithProps (type alias)

**Signature**

```ts
export type LoadResultWithProps<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> = LoadResult<TypeDoc> & {
  props?: LoadResult<TypeDoc>[]
}
```
