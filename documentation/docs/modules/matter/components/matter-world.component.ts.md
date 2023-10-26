---
title: matter/components/matter-world.component.ts
nav_order: 92
parent: Modules
---

## matter-world.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MatterWorldComponent (class)](#matterworldcomponent-class)
    - [init (method)](#init-method)
    - [simulate (method)](#simulate-method)
    - [startDebugger (method)](#startdebugger-method)
    - [stopDebugger (method)](#stopdebugger-method)
    - [dispose (method)](#dispose-method)
    - [matterEngine (property)](#matterengine-property)
    - [factory (property)](#factory-property)

---

# utils

## MatterWorldComponent (class)

**Signature**

```ts
export declare class MatterWorldComponent
```

### init (method)

**Signature**

```ts
async init(): Promise<void>
```

### simulate (method)

**Signature**

```ts
simulate(delta: number): void
```

### startDebugger (method)

**Signature**

```ts
startDebugger(world: Gg2dWorld, drawer: IDebugPhysicsDrawer<Point2, number>): void
```

### stopDebugger (method)

**Signature**

```ts
stopDebugger(): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### matterEngine (property)

**Signature**

```ts
matterEngine: any
```

### factory (property)

**Signature**

```ts
readonly factory: MatterFactory
```
