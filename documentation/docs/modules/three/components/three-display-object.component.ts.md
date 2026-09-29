---
title: three/components/three-display-object.component.ts
nav_order: 181
parent: Modules
---

## three-display-object.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ThreeDisplayObjectComponent (class)](#threedisplayobjectcomponent-class)
    - [enableRenderLayer (method)](#enablerenderlayer-method)
    - [disableRenderLayer (method)](#disablerenderlayer-method)
    - [isRenderLayerEnabled (method)](#isrenderlayerenabled-method)
    - [isEmpty (method)](#isempty-method)
    - [popChild (method)](#popchild-method)
    - [getBoundings (method)](#getboundings-method)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
    - [disposeMesh (method)](#disposemesh-method)
    - [entity (property)](#entity-property)
    - [materialOptions (property)](#materialoptions-property)

---

# utils

## ThreeDisplayObjectComponent (class)

**Signature**

```ts
export declare class ThreeDisplayObjectComponent {
  constructor(public nativeMesh: Object3D, materialOptions?: DisplayObject3dOpts<Texture>)
}
```

### enableRenderLayer (method)

**Signature**

```ts
public enableRenderLayer(layer: RenderLayer): void
```

### disableRenderLayer (method)

**Signature**

```ts
public disableRenderLayer(layer: RenderLayer): void
```

### isRenderLayerEnabled (method)

**Signature**

```ts
public isRenderLayerEnabled(layer: RenderLayer): boolean
```

### isEmpty (method)

**Signature**

```ts
public isEmpty(): boolean
```

### popChild (method)

**Signature**

```ts
popChild(name: string): ThreeDisplayObjectComponent | null
```

### getBoundings (method)

**Signature**

```ts
getBoundings(): GgBox3d
```

### clone (method)

**Signature**

```ts
clone(): ThreeDisplayObjectComponent
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: ThreeGgWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: ThreeGgWorld, dispose?: boolean): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### disposeMesh (method)

**Signature**

```ts
private disposeMesh(mesh: Mesh)
```

### entity (property)

**Signature**

```ts
entity: IEntity<any, any, GgWorldTypeDocRepo<any, any>> | null
```

### materialOptions (property)

The options this mesh was actually built with, when constructed via `ThreeFactory.createPrimitive`
(or a shortcut built on it) - see `IMaterialReadable3dComponent`'s own doc. Left unset for a mesh
built any other way (e.g. a loaded `.glb`), which is the reason this is `Partial` rather than a
hard implementation of that interface - check with `isMaterialReadable3d` before relying on it.

**Signature**

```ts
readonly materialOptions: DisplayObject3dOpts<Texture<unknown, TextureEventMap>> | undefined
```
