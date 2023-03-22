---
title: core/base/gg-world.ts
nav_order: 48
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
    - [dispose (method)](#dispose-method)
    - [addEntity (method)](#addentity-method)
    - [removeEntity (method)](#removeentity-method)
    - [registerConsoleCommand (method)](#registerconsolecommand-method)
    - [runConsoleCommand (method)](#runconsolecommand-method)
    - [triggerPhysicsDebugView (method)](#triggerphysicsdebugview-method)
    - [keyboardController (property)](#keyboardcontroller-property)
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

### dispose (method)

**Signature**

```ts
public dispose(): void
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

### keyboardController (property)

**Signature**

```ts
readonly keyboardController: KeyboardController
```

### children (property)

**Signature**

```ts
readonly children: GgEntity[]
```

### tickListeners (property)

**Signature**

```ts
readonly tickListeners: ITickListener[]
```

### commands (property)

**Signature**

```ts
commands: { [key: string]: { handler: (...args: string[]) => Promise<string>; doc?: string | undefined; }; }
```
