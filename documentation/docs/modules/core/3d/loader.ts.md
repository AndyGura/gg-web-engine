---
title: core/3d/loader.ts
nav_order: 30
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
  - [LoadOptions (type alias)](#loadoptions-type-alias)
  - [LoadResourcesResult (type alias)](#loadresourcesresult-type-alias)
  - [LoadResult (type alias)](#loadresult-type-alias)
  - [LoadResultWithProps (type alias)](#loadresultwithprops-type-alias)

---

# utils

## Gg3dLoader (class)

**Signature**

```ts
export declare class Gg3dLoader {
  constructor(protected readonly world: Gg3dWorld)
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
  ): Promise<LoadResourcesResult>
```

### loadGgGlb (method)

**Signature**

```ts
public async loadGgGlb(
    path: string,
    options: Partial<LoadOptions> = defaultLoadOptions,
  ): Promise<LoadResultWithProps>
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
export type LoadResourcesResult = {
  resources: { object3D: IGg3dObject | null; body: IGg3dBody | null }[]
  meta: GgMeta
}
```

## LoadResult (type alias)

**Signature**

```ts
export type LoadResult = {
  entities: Gg3dEntity[]
  meta: GgMeta
}
```

## LoadResultWithProps (type alias)

**Signature**

```ts
export type LoadResultWithProps = LoadResult & { props?: LoadResult[] }
```