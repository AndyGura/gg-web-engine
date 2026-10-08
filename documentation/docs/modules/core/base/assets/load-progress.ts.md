---
title: core/base/assets/load-progress.ts
nav_order: 103
parent: Modules
---

## load-progress overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AssetProgress (class)](#assetprogress-class)
    - [file (method)](#file-method)
    - [done (method)](#done-method)
    - [emit (method)](#emit-method)
  - [DECODE_PROGRESS_SHARE](#decode_progress_share)
  - [LoadProgress (type alias)](#loadprogress-type-alias)
  - [LoadProgressGroup (class)](#loadprogressgroup-class)
    - [sub (method)](#sub-method)
    - [complete (method)](#complete-method)
    - [finish (method)](#finish-method)
    - [emit (method)](#emit-method-1)
  - [LoadTaskOptions (type alias)](#loadtaskoptions-type-alias)
  - [abortError](#aborterror)
  - [abortable](#abortable)
  - [isAbortError](#isaborterror)
  - [linkSignals](#linksignals)
  - [throwIfAborted](#throwifaborted)

---

# utils

## AssetProgress (class)

Progress of one asset: any number of fetched files, then one decode step.

**Signature**

```ts
export declare class AssetProgress {
  constructor(private readonly url: string, private readonly onProgress: ((progress: LoadProgress) => void) | undefined)
}
```

### file (method)

Registers one file of the asset; the returned function reports its fetched bytes.

**Signature**

```ts
public file(): (loaded: number, total: number | null, done: boolean) => void
```

### done (method)

Marks the asset fetched and decoded.

**Signature**

```ts
public done(): void
```

### emit (method)

**Signature**

```ts
private emit(): void
```

## DECODE_PROGRESS_SHARE

Share of one asset's progress taken by decoding it (parsing, GPU upload) after the fetch.

**Signature**

```ts
export declare const DECODE_PROGRESS_SHARE: 0.3
```

## LoadProgress (type alias)

How far a load has come. Reported by every loader that takes {@link LoadTaskOptions}: for a
single asset it describes that asset, for a level (or `preload`) everything it references.

**Signature**

```ts
export type LoadProgress = {
  /** 0..1. Never decreases within one load, also when more assets turn up along the way. */
  fraction: number
  /** Assets fully fetched and decoded. */
  loadedItems: number
  /** Assets known so far. Grows when an asset references further ones (a model's props). */
  totalItems: number
  bytesLoaded: number
  /** `null` while the size of any asset being fetched is unknown (no `Content-Length`). */
  bytesTotal: number | null
  /** URL of the asset worked on most recently. */
  current: string | null
}
```

## LoadProgressGroup (class)

Combines the progress of several loads into one. Each `sub()` is a slot to hand to one nested
loader call as its options; the combined fraction is the mean over every asset the slots report.

A slot that has not reported any asset yet, and is not complete, holds the weight of one asset:
create the slots of every step known up front (also the ones that only start after an earlier
step finished), so a first step that completes early does not read as the whole load being done.
When assets turn up late and lower the mean, the shown fraction stays where it was and from then
on covers the rest of the bar in proportion to the work that remains, so it never goes down and
never stalls.

**Signature**

```ts
export declare class LoadProgressGroup {
  constructor(private readonly options: LoadTaskOptions)
}
```

### sub (method)

Options for one nested load: its progress goes into this group, signal and scope carry over.

**Signature**

```ts
public sub(): LoadTaskOptions
```

### complete (method)

Reports the load a slot was handed to as settled, also when it reported nothing (a step that
loads nothing, or loaded only what the cache already held), so its reserved weight is released.

**Signature**

```ts
public complete(slot: LoadTaskOptions): void
```

### finish (method)

Reports the group complete. Call once everything nested has settled.

**Signature**

```ts
public finish(): void
```

### emit (method)

**Signature**

```ts
private emit(): void
```

## LoadTaskOptions (type alias)

Options every loader of `world.loader` takes on top of its own.

**Signature**

```ts
export type LoadTaskOptions = {
  /** Called on every progress change, and once with `fraction: 1` when the load is complete. */
  onProgress?: (progress: LoadProgress) => void
  /** Cancels the load: the returned promise rejects with an `AbortError`. */
  signal?: AbortSignal
  /**
   * Who holds the loaded assets in the loader's cache (see `AssetScope`). Without one they are held
   * until the world is disposed.
   */
  scope?: AssetScope
}
```

## abortError

**Signature**

```ts
export declare function abortError(): Error
```

## abortable

Settles like `promise`, or rejects with an `AbortError` as soon as one of `signals` aborts.

**Signature**

```ts
export declare function abortable<T>(promise: Promise<T>, ...signals: (AbortSignal | undefined)[]): Promise<T>
```

## isAbortError

Whether `error` is what an aborted load rejects with.

**Signature**

```ts
export declare function isAbortError(error: unknown): boolean
```

## linkSignals

A signal aborted as soon as any of `signals` is. `release()` detaches it from them once the work
it was made for is over, so a long-lived source signal doesn't keep a listener per load.

**Signature**

```ts
export declare function linkSignals(...signals: (AbortSignal | undefined)[]): {
  signal: AbortSignal
  release: () => void
}
```

## throwIfAborted

**Signature**

```ts
export declare function throwIfAborted(signal: AbortSignal | undefined): void
```
