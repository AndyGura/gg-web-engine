---
title: three/components/three-display-object.component.ts
nav_order: 118
parent: Modules
---

## three-display-object.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ThreeDisplayObjectComponent (class)](#threedisplayobjectcomponent-class)
    - [isEmpty (method)](#isempty-method)
    - [popChild (method)](#popchild-method)
    - [getBoundings (method)](#getboundings-method)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
    - [disposeMesh (method)](#disposemesh-method)
    - [entity (property)](#entity-property)

---

# utils

## ThreeDisplayObjectComponent (class)

**Signature**

```ts
export declare class ThreeDisplayObjectComponent {
  constructor(public nativeMesh: Object3D)
}
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
addToWorld(world: Gg3dWorld<ThreeSceneComponent>): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Gg3dWorld<ThreeSceneComponent>): void
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
entity: any
```
