---
title: core/base/assets/asset-cache.ts
nav_order: 99
parent: Modules
---

## asset-cache overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AssetCache (class)](#assetcache-class)
    - [has (method)](#has-method)
    - [createScope (method)](#createscope-method)
    - [acquire (method)](#acquire-method)
    - [remove (method)](#remove-method)
    - [dispose (method)](#dispose-method)
    - [root (property)](#root-property)
  - [AssetScope (class)](#assetscope-class)
    - [release (method)](#release-method)

---

# utils

## AssetCache (class)

The per-world asset cache behind `world.loader`: one entry per asset, shared by concurrent and
repeated loads, held by scopes and freed when the last scope holding it is released.

**Signature**

```ts
export declare class AssetCache
```

### has (method)

**Signature**

```ts
public has(key: string): boolean
```

### createScope (method)

**Signature**

```ts
public createScope(): AssetScope
```

### acquire (method)

Returns the asset cached under `key` for `scope` to hold, loading it with `load` when it is not
there. A load that is aborted by the caller that started it is started again for the others
still waiting for it.

**Signature**

```ts
public async acquire<T>(
    key: string,
    scope: AssetScope | undefined,
    load: () => Promise<{ value: T; dispose?: () => void }>,
    signal?: AbortSignal,
    onShared?: () => void,
  ): Promise<T>
```

### remove (method)

**Signature**

```ts
private remove(key: string, entry: Entry): void
```

### dispose (method)

Frees every entry. Loads still running free their result as they finish.

**Signature**

```ts
public dispose(): void
```

### root (property)

Holds every asset loaded without a scope of its own, until the cache is disposed.

**Signature**

```ts
readonly root: AssetScope
```

## AssetScope (class)

A holder of cached assets. Every load made with a scope keeps what it loaded alive for as long as
the scope is; `release()` lets go of all of it, and whatever no other scope holds is freed.
Created with `world.loader.createAssetScope()`.

**Signature**

```ts
export declare class AssetScope {
  constructor(private readonly cache: AssetCache)
}
```

### release (method)

Lets go of everything loaded with this scope. The scope can't be used afterwards.

**Signature**

```ts
public release(): void
```
