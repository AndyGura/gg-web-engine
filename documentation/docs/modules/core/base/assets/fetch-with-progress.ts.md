---
title: core/base/assets/fetch-with-progress.ts
nav_order: 101
parent: Modules
---

## fetch-with-progress overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [fetchWithProgress](#fetchwithprogress)
  - [imageBlob](#imageblob)

---

# utils

## fetchWithProgress

Fetches `url` fully, reporting how many bytes have arrived. The size comes from
`Content-Length`; a server that hides it (compressed or cross-origin responses often do) leaves
`total` at `null` until the download is complete.

**Signature**

```ts
export async function fetchWithProgress(
  url: string,
  onBytes?: (loaded: number, total: number | null, done: boolean) => void,
  signal?: AbortSignal
): Promise<ArrayBuffer>
```

## imageBlob

Wraps a fetched image file in a `Blob` typed by the extension in `url`. A browser recognizes
most image formats by their content, but decodes an SVG only when told that it is one.

**Signature**

```ts
export declare function imageBlob(data: ArrayBuffer, url: string): Blob
```
