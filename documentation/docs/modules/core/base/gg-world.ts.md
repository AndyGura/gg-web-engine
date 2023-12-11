---
title: core/base/gg-world.ts
nav_order: 75
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

---

# utils

## GgWorld (class)

**Signature**

```ts
export declare class GgWorld<D, R, V, P> {
  protected constructor(public readonly visualScene: V, public readonly physicsWorld: P)
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
    descr: any,
    position?: D,
    rotation?: R,
  ): IPositionable<D, R> & IRenderableEntity<D, R, V, P>;
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
readonly children: IEntity<any, any, IVisualSceneComponent<any, any>, IPhysicsWorldComponent<any, any>>[]
```

### tickListeners (property)

**Signature**

```ts
readonly tickListeners: IEntity<any, any, IVisualSceneComponent<any, any>, IPhysicsWorldComponent<any, any>>[]
```
