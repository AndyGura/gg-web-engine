---
title: core/3d/loaders.ts
nav_order: 54
parent: Modules
---

## loaders overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IDisplayObject3dComponentLoader (interface)](#idisplayobject3dcomponentloader-interface)
  - [IPhysicsBody3dComponentLoader (class)](#iphysicsbody3dcomponentloader-class)
    - [loadFromGgGlb (method)](#loadfromggglb-method)

---

# utils

## IDisplayObject3dComponentLoader (interface)

**Signature**

```ts
export interface IDisplayObject3dComponentLoader<TypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D> {
  loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<TypeDoc['displayObject'] | null>
}
```

## IPhysicsBody3dComponentLoader (class)

**Signature**

```ts
export declare class IPhysicsBody3dComponentLoader<TypeDoc> {
  protected constructor(protected readonly world: IPhysicsWorld3dComponent)
}
```

### loadFromGgGlb (method)

**Signature**

```ts
async loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<TypeDoc['rigidBody'][]>
```