---
title: ammo/ammo-debugger.ts
nav_order: 1
parent: Modules
---

## ammo-debugger overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AmmoDebugger (class)](#ammodebugger-class)
    - [draw3dText (method)](#draw3dtext-method)
    - [drawContactPoint (method)](#drawcontactpoint-method)
    - [drawLine (method)](#drawline-method)
    - [getDebugMode (method)](#getdebugmode-method)
    - [update (method)](#update-method)
    - [setDebugFlags (method)](#setdebugflags-method)
    - [setDebugMode (method)](#setdebugmode-method)
    - [reportErrorWarning (method)](#reporterrorwarning-method)
    - [ammoInstance (property)](#ammoinstance-property)
  - [DebugBufferSize](#debugbuffersize)

---

# utils

## AmmoDebugger (class)

**Signature**

```ts
export declare class AmmoDebugger {
  constructor(private readonly world: Gg3dPhysicsWorld, private readonly drawer: GgDebugPhysicsDrawer<Point3, Point4>)
}
```

### draw3dText (method)

**Signature**

```ts
draw3dText(location: Ammo.btVector3, textString: string): void
```

### drawContactPoint (method)

**Signature**

```ts
drawContactPoint(
    pointOnB: Ammo.btVector3,
    normalOnB: Ammo.btVector3,
    distance: number,
    lifeTime: number,
    color: Ammo.btVector3,
  ): void
```

### drawLine (method)

**Signature**

```ts
drawLine(from: Ammo.btVector3, to: Ammo.btVector3, color: Ammo.btVector3): void
```

### getDebugMode (method)

**Signature**

```ts
getDebugMode(): number
```

### update (method)

**Signature**

```ts
update(): void
```

### setDebugFlags (method)

**Signature**

```ts
setDebugFlags(flags: AmmoDebugMode[]): void
```

### setDebugMode (method)

**Signature**

```ts
setDebugMode(debugMode: number): void
```

### reportErrorWarning (method)

**Signature**

```ts
reportErrorWarning(warningString: string): void
```

### ammoInstance (property)

**Signature**

```ts
readonly ammoInstance: any
```

## DebugBufferSize

**Signature**

```ts
export declare const DebugBufferSize: number
```