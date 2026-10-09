---
title: pixi/components/pixi-text.component.ts
nav_order: 191
parent: Modules
---

## pixi-text.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [PixiTextComponent (class)](#pixitextcomponent-class)
    - [setStyle (method)](#setstyle-method)
    - [clone (method)](#clone-method)
    - [nativeSprite (property)](#nativesprite-property)

---

# utils

## PixiTextComponent (class)

pixi.js implementation of `IText2dComponent`: a pixi `Text`. Built by `PixiFactory.createText`.

**Signature**

```ts
export declare class PixiTextComponent {
  constructor(text: string, style: Text2dStyle = {})
}
```

### setStyle (method)

**Signature**

```ts
public setStyle(style: Text2dStyle): void
```

### clone (method)

**Signature**

```ts
clone(): PixiTextComponent
```

### nativeSprite (property)

**Signature**

```ts
readonly nativeSprite: Text
```
