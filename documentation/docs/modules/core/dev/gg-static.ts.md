---
title: core/dev/gg-static.ts
nav_order: 182
parent: Modules
---

## gg-static overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgStatic (class)](#ggstatic-class)
    - [worldBackends (static method)](#worldbackends-static-method)
    - [describeWorld (static method)](#describeworld-static-method)
    - [toggleDevConsole (method)](#toggledevconsole-method)
    - [autoAssignSelectedWorld (method)](#autoassignselectedworld-method)
    - [registerConsoleCommand (method)](#registerconsolecommand-method)
    - [createPerformanceMeter (method)](#createperformancemeter-method)
    - [deregisterConsoleCommand (method)](#deregisterconsolecommand-method)
    - [deregisterWorldCommands (method)](#deregisterworldcommands-method)
    - [console (method)](#console-method)
    - [runConsoleCommand (method)](#runconsolecommand-method)
    - [consoleKeyPressEventListener (property)](#consolekeypresseventlistener-property)
    - [consoleCommands (property)](#consolecommands-property)

---

# utils

## GgStatic (class)

**Signature**

```ts
export declare class GgStatic {
  private constructor()
}
```

### worldBackends (static method)

`three + rapier3d + webaudio`: the backend names of a world's scenes, `-` for a missing one.

**Signature**

```ts
private static worldBackends(world: GgWorld<any, any>): string
```

### describeWorld (static method)

The `world` command's report: the name first, then one `key: value` line per fact.

**Signature**

```ts
private static describeWorld(world: GgWorld<any, any>): string
```

### toggleDevConsole (method)

**Signature**

```ts
public toggleDevConsole(value: boolean)
```

### autoAssignSelectedWorld (method)

**Signature**

```ts
private autoAssignSelectedWorld()
```

### registerConsoleCommand (method)

Register a dev-console command, globally (`world` = `null`) or for one world.

**Signature**

```ts
public registerConsoleCommand(
    world: GgWorld<any, any> | null,
    command: string,
    handler: (...args: string[]) => Promise<string>,
    doc?: string,
    mutates?: boolean,
  ): void
```

### createPerformanceMeter (method)

Builds the entity the `performance` console command measures a world with. World classes reach
it through `window.ggstatic` instead of importing it, so nothing outside `dev/` depends on it.

**Signature**

```ts
public createPerformanceMeter(samples: number, maxRows: number): PerformanceMeterEntity
```

### deregisterConsoleCommand (method)

Remove one command registered via {@link registerConsoleCommand}; a no-op if it isn't registered.

**Signature**

```ts
public deregisterConsoleCommand(world: GgWorld<any, any> | null, command: string): void
```

### deregisterWorldCommands (method)

**Signature**

```ts
public deregisterWorldCommands(world: GgWorld<any, any> | null): void
```

### console (method)

**Signature**

```ts
public async console(input: string): Promise<string>
```

### runConsoleCommand (method)

**Signature**

```ts
public async runConsoleCommand(command: string, args: string[]): Promise<string>
```

### consoleKeyPressEventListener (property)

**Signature**

```ts
consoleKeyPressEventListener: (event: KeyboardEvent) => void
```

### consoleCommands (property)

**Signature**

```ts
consoleCommands: Map<
  GgWorld<any, any, GgWorldTypeDocRepo<any, any>, GgWorldSceneTypeRepo<any, any, GgWorldTypeDocRepo<any, any>>> | null,
  {
    [key: string]: {
      handler: (...args: string[]) => Promise<string>
      doc?: string | undefined
      mutates?: boolean | undefined
    }
  }
>
```
