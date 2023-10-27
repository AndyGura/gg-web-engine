---
title: ammo/components/ammo-world.component.ts
nav_order: 9
parent: Modules
---

## ammo-world.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AmmoWorldComponent (class)](#ammoworldcomponent-class)
    - [init (method)](#init-method)
    - [simulate (method)](#simulate-method)
    - [startDebugger (method)](#startdebugger-method)
    - [stopDebugger (method)](#stopdebugger-method)
    - [dispose (method)](#dispose-method)
    - [\_dynamicAmmoWorld (property)](#_dynamicammoworld-property)

---

# utils

## AmmoWorldComponent (class)

**Signature**

```ts
export declare class AmmoWorldComponent
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
startDebugger(
    world: Gg3dWorld<IVisualScene3dComponent, AmmoWorldComponent>,
    drawer: IDebugPhysicsDrawer<Point3, Point4>,
  ): void
```

### stopDebugger (method)

**Signature**

```ts
stopDebugger(world: Gg3dWorld<IVisualScene3dComponent, AmmoWorldComponent>): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### \_dynamicAmmoWorld (property)

**Signature**

```ts
_dynamicAmmoWorld: any
```
