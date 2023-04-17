---
title: core/base/gg-world.ts
nav_order: 47
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
    - [registerConsoleCommand (method)](#registerconsolecommand-method)
    - [runConsoleCommand (method)](#runconsolecommand-method)
    - [triggerPhysicsDebugView (method)](#triggerphysicsdebugview-method)
    - [worldClock (property)](#worldclock-property)
    - [keyboardInput (property)](#keyboardinput-property)
    - [children (property)](#children-property)
    - [tickListeners (property)](#ticklisteners-property)
    - [commands (property)](#commands-property)

---

# utils

## GgWorld (class)

**Signature**

```ts
export declare class GgWorld<D, R, V, P> {
  constructor(
    public readonly visualScene: V,
    public readonly physicsWorld: P,
    protected readonly consoleEnabled: boolean = false
  )
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
abstract addPrimitiveRigidBody(descr: any, position?: D, rotation?: R): GgPositionableEntity<D, R>;
```

### addEntity (method)

**Signature**

```ts
public addEntity(entity: GgEntity): void
```

### removeEntity (method)

**Signature**

```ts
public removeEntity(entity: GgEntity, dispose = true): void
```

### registerConsoleCommand (method)

**Signature**

```ts
public registerConsoleCommand(command: string, handler: (...args: string[]) => Promise<string>, doc?: string): void
```

### runConsoleCommand (method)

**Signature**

```ts
public async runConsoleCommand(command: string, args: string[]): Promise<string>
```

### triggerPhysicsDebugView (method)

**Signature**

```ts
public triggerPhysicsDebugView()
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

### children (property)

**Signature**

```ts
readonly children: GgEntity[]
```

### tickListeners (property)

**Signature**

```ts
readonly tickListeners: GgEntity[]
```

### commands (property)

**Signature**

```ts
commands: { [key: string]: { handler: (...args: string[]) => Promise<string>; doc?: string | undefined; }; }
```
