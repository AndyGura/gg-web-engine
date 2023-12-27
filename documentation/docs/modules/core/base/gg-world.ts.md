---
title: core/base/gg-world.ts
nav_order: 78
parent: Modules
---

## gg-world overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgWorld (class)](#ggworld-class)
    - [init (method)](#init-method)
    - [start (method)](#start-method)
    - [pauseWorld (method)](#pauseworld-method)
    - [resumeWorld (method)](#resumeworld-method)
    - [createClock (method)](#createclock-method)
    - [dispose (method)](#dispose-method)
    - [addPrimitiveRigidBody (method)](#addprimitiverigidbody-method)
    - [addEntity (method)](#addentity-method)
    - [removeEntity (method)](#removeentity-method)
    - [worldClock (property)](#worldclock-property)
    - [keyboardInput (property)](#keyboardinput-property)
    - [name (property)](#name-property)
    - [children (property)](#children-property)
    - [tickListeners (property)](#ticklisteners-property)
  - [PhysicsTypeDocRepo (type alias)](#physicstypedocrepo-type-alias)
  - [VisualTypeDocRepo (type alias)](#visualtypedocrepo-type-alias)

---

# utils

## GgWorld (class)

**Signature**

```ts
export declare class GgWorld<D, R, VTypeDoc, PTypeDoc, VS, PW> {
  protected constructor(public readonly visualScene: VS, public readonly physicsWorld: PW)
}
```

### init (method)

**Signature**

```ts
public async init()
```

### start (method)

**Signature**

```ts
public start()
```

### pauseWorld (method)

**Signature**

```ts
public pauseWorld()
```

### resumeWorld (method)

**Signature**

```ts
public resumeWorld()
```

### createClock (method)

**Signature**

```ts
public createClock(autoStart: boolean): PausableClock
```

### dispose (method)

**Signature**

```ts
public dispose(): void
```

### addPrimitiveRigidBody (method)

**Signature**

```ts
abstract addPrimitiveRigidBody(
    descr: unknown, // type defined in subclasses
    position?: D,
    rotation?: R,
    material?: unknown, // type defined in subclasses
  ): IPositionable<D, R> & IRenderableEntity<D, R, VTypeDoc>;
```

### addEntity (method)

**Signature**

```ts
public addEntity(entity: IEntity): void
```

### removeEntity (method)

**Signature**

```ts
public removeEntity(entity: IEntity, dispose = false): void
```

### worldClock (property)

**Signature**

```ts
readonly worldClock: PausableClock
```

### keyboardInput (property)

**Signature**

```ts
readonly keyboardInput: KeyboardInput
```

### name (property)

**Signature**

```ts
name: string
```

### children (property)

**Signature**

```ts
readonly children: IEntity<any, any, VisualTypeDocRepo<any, any>, PhysicsTypeDocRepo<any, any>>[]
```

### tickListeners (property)

**Signature**

```ts
readonly tickListeners: IEntity<any, any, VisualTypeDocRepo<any, any>, PhysicsTypeDocRepo<any, any>>[]
```

## PhysicsTypeDocRepo (type alias)

**Signature**

```ts
export type PhysicsTypeDocRepo<D, R> = {
  factory: unknown
  rigidBody: IRigidBodyComponent<D, R>
  trigger: ITriggerComponent<D, R>
}
```

## VisualTypeDocRepo (type alias)

**Signature**

```ts
export type VisualTypeDocRepo<D, R> = {
  factory: unknown
  displayObject: IDisplayObjectComponent<D, R>
  renderer: IRendererComponent<D, R>
}
```
