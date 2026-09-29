---
title: core/2d/components/rendering/i-material-readable-2d.component.ts
nav_order: 21
parent: Modules
---

## i-material-readable-2d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IMaterialReadable2dComponent (interface)](#imaterialreadable2dcomponent-interface)
  - [isMaterialReadable2d](#ismaterialreadable2d)

---

# utils

## IMaterialReadable2dComponent (interface)

2D counterpart of `IMaterialReadable3dComponent` - a display object that remembers the
`DisplayObject2dOpts` (`color`/`texture`) it was actually built with, e.g. one of
`IDisplayObject2dComponentFactory.createPrimitive`'s own outputs. Optional/adapter-specific on
purpose - check with {@link isMaterialReadable2d} before reading {@link materialOptions}.

**Signature**

```ts
export interface IMaterialReadable2dComponent<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D>
  extends IDisplayObject2dComponent<VTypeDoc> {
  /** The options this display object was actually constructed with - see the 3D counterpart's own
   * doc for the exact contract (resolved, not necessarily a verbatim echo of the caller's input). */
  readonly materialOptions: DisplayObject2dOpts<VTypeDoc['texture']>
}
```

## isMaterialReadable2d

Type guard for {@link IMaterialReadable2dComponent} - see the 3D counterpart's own doc for why
this shape (a field check, not `instanceof`) is used.

**Signature**

```ts
export declare function isMaterialReadable2d<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D>(
  displayObject: VTypeDoc['displayObject'] | null | undefined
): displayObject is IMaterialReadable2dComponent<VTypeDoc>
```
