---
title: core/base/gg-viewport-manager.ts
nav_order: 46
parent: Modules
---

## gg-viewport-manager overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [CanvasAppDescr (type alias)](#canvasappdescr-type-alias)
  - [GgViewportManager (class)](#ggviewportmanager-class)
    - [getStageAsync (method)](#getstageasync-method)
    - [createCanvas (method)](#createcanvas-method)
    - [registerCanvas (method)](#registercanvas-method)
    - [assignRendererToCanvas (method)](#assignrenderertocanvas-method)
    - [destroyed (property)](#destroyed-property)

---

# utils

## CanvasAppDescr (type alias)

**Signature**

```ts
export type CanvasAppDescr = { canvas: HTMLCanvasElement; renderer?: BaseGgRenderer }
```

## GgViewportManager (class)

**Signature**

```ts
export declare class GgViewportManager {
  private constructor()
}
```

### getStageAsync (method)

**Signature**

```ts
private getStageAsync(): Promise<HTMLDivElement>
```

### createCanvas (method)

**Signature**

```ts
public async createCanvas(zIndex: number): Promise<HTMLCanvasElement>
```

### registerCanvas (method)

**Signature**

```ts
public async registerCanvas(canvas: HTMLCanvasElement, zIndex: number): Promise<void>
```

### assignRendererToCanvas (method)

**Signature**

```ts
public async assignRendererToCanvas(renderer: BaseGgRenderer, canvas: HTMLCanvasElement): Promise<void>
```

### destroyed (property)

**Signature**

```ts
destroyed: any
```
