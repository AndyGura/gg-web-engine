---
title: core/3d/loader.ts
nav_order: 91
parent: Modules
---

## loader overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg3dLoader (class)](#gg3dloader-class)
    - [propsOf (static method)](#propsof-static-method)
    - [loadGgGlbFiles (method)](#loadggglbfiles-method)
    - [fetchGgGlb (method)](#fetchggglb-method)
    - [buildGgGlbResources (method)](#buildggglbresources-method)
    - [acquireGgGlb (method)](#acquireggglb-method)
    - [loadGgGlbResources (method)](#loadggglbresources-method)
    - [preloadGgGlb (method)](#preloadggglb-method)
    - [preloadInitialChunks (method)](#preloadinitialchunks-method)
    - [preloadAsset (method)](#preloadasset-method)
    - [loadGgGlb (method)](#loadggglb-method)
    - [override (property)](#override-property)
    - [override (property)](#override-property-1)
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

### propsOf (static method)

The props/scenes a meta references, as further pairs to load.

**Signature**

```ts
private static propsOf(meta: GgMeta, path: string, propsPath: string | undefined)
```

### loadGgGlbFiles (method)

Fetches a `.glb`/`.meta` pair. Nothing is cached here - `loadGgGlb` is the cached entry point.

**Signature**

```ts
public async loadGgGlbFiles(path: string, options: LoadTaskOptions = {}): Promise<[ArrayBuffer, GgMeta]>
```

### fetchGgGlb (method)

**Signature**

```ts
private async fetchGgGlb(
    path: string,
    item: AssetProgress,
    signal: AbortSignal | undefined,
  ): Promise<[ArrayBuffer, GgMeta]>
```

### buildGgGlbResources (method)

Fetches and parses a pair into display objects and bodies that own their resources.

**Signature**

```ts
private async buildGgGlbResources(
    path: string,
    item: AssetProgress,
    signal: AbortSignal | undefined,
  ): Promise<LoadResourcesResult<TypeDoc>>
```

### acquireGgGlb (method)

The cached, never-spawned original of a pair - `loadGgGlbResources` hands out copies of it.

**Signature**

```ts
private acquireGgGlb(path: string, options: LoadTaskOptions): Promise<LoadResourcesResult<TypeDoc>>
```

### loadGgGlbResources (method)

Loads a `.glb`/`.meta` pair into display objects and bodies, not yet wrapped in entities. The
pair is fetched and parsed once per world and kept in the loader's cache; every call gets its
own copies (`clone()`) to place, which share the cached original's geometry, materials and
collision shapes. `CachingStrategy.Nothing` skips the cache: the pair is fetched and parsed
for this call alone, and the result owns its resources.

**Signature**

```ts
public async loadGgGlbResources(
    path: string,
    cachingStrategy?: CachingStrategy,
    options: LoadTaskOptions = {},
  ): Promise<LoadResourcesResult<TypeDoc>>
```

### preloadGgGlb (method)

Brings a pair, and with `loadProps` everything it references, into the cache.

**Signature**

```ts
private async preloadGgGlb(
    path: string,
    loadProps: boolean,
    propsPath: string | undefined,
    options: LoadTaskOptions,
  ): Promise<void>
```

### preloadInitialChunks (method)

**Signature**

```ts
async preloadInitialChunks(
    entity: MapGraph3dEntity<TypeDoc>,
    load: LoadTaskOptions,
  ): Promise<void>
```

### preloadAsset (method)

**Signature**

```ts
async preloadAsset(ref: AssetRef, options: LoadTaskOptions): Promise<void>
```

### loadGgGlb (method)

Load a GG GLB+meta pair into ready-to-add `Entity3d`s (one per rigid body the `.meta`
declares, plus one for any body-less leftover geometry), recursively loading any prop/scene
dummies too when `options.loadProps` is on. Every entity's `name` is scoped under
`options.nameScope` (see `LoadOptions.nameScope` - a process-unique scope by default), so
loading the same file repeatedly never produces colliding names.

**Signature**

```ts
public async loadGgGlb(
    path: string,
    options: Partial<LoadOptions> & LoadTaskOptions = {},
  ): Promise<LoadResultWithProps<TypeDoc>>
```

### override (property)

Preloads the chunks `entity` loads first, with the level's progress and signal, held only until
the entity's own chunk scopes have taken them over - so they unload with their chunk like any
other.

**Signature**

```ts
override: any
```

### override (property)

**Signature**

```ts
override: any
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
   * Caching strategy, see `CachingStrategy`. Cached when left out, same as `loadGgGlb` itself.
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

  /**
   * Scope for the names of every entity the GLB produces, see `LoadOptions.nameScope`. Defaults to
   * this `"Glb"` entity's own resolved `name` (`name`, below) - which `LevelLoader.loadLevel`
   * guarantees is unique in the world and deterministic per level document - so two `"Glb"`
   * entries pointing at the same file never collide. `null` keeps the raw native object names.
   */
  nameScope?: string | null

  /**
   * Whether the loaded model casts shadows, see `LoadOptions.castShadow`. Left as authored in the
   * file when omitted.
   */
  castShadow?: boolean

  /**
   * Whether the loaded model receives shadows, see `LoadOptions.receiveShadow`. Left as authored in
   * the file when omitted.
   */
  receiveShadow?: boolean

  /**
   * The entity's own resolved name - filled in by `LevelLoader.createEntity`/`loadLevel` (explicit
   * `EntityJson.name`, else the level-derived fallback), not meant to be set in `config`
   */
  name?: string
}
```

## LoadOptions (type alias)

**Signature**

```ts
export type LoadOptions = {
  /** See `CachingStrategy`. Cached when left out. */
  cachingStrategy?: CachingStrategy
  // initial position
  position: Point3
  // initial rotation
  rotation: Point4
  // process dummies with flag is_prop
  loadProps: boolean
  // path where to find prop scenes
  propsPath?: string
  /**
   * Scope every produced entity's `name` under, so that the same file can be loaded any number of
   * times into one world without the (Blender-authored, hence identical on every load) object
   * names colliding - `GgWorld` enforces world-wide name uniqueness and `addEntity` rejects a
   * collision outright. Each entity is named `` `${nameScope}__${objectName}` `` (`objectName`
   * being the body's, else the display object's, own native name - falling back to the entity's
   * index in `entities` when neither has one), and every prop/scene dummy loaded via `loadProps`
   * recurses under `` `${nameScope}__${dummy.name}` `` - deterministic purely from `nameScope` and
   * the files' own content, so two peers loading the same asset under the same scope agree on
   * every name.
   * - a `string`: that scope, e.g. the `"Glb"` level entity class passes its own entity name;
   * - omitted/`undefined` (the default): a fresh process-unique scope (`` `glb_${n}` ``, `n` a
   *   per-process counter) - always collision-free, but not deterministic across peers/reloads;
   * - `null`: no scoping at all - entities keep their raw native object names. Opt in to this
   *   only to look entities up by their Blender names, and only when the file is loaded once.
   */
  nameScope?: string | null
  /**
   * When set, every loaded display object (including nested props) gets this `castShadow` value,
   * see `IDisplayObject3dComponent.castShadow`. Left as authored in the file when omitted.
   */
  castShadow?: boolean
  /** Same as `castShadow`, for `IDisplayObject3dComponent.receiveShadow`. */
  receiveShadow?: boolean
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
