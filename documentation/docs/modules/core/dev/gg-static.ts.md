---
title: core/dev/gg-static.ts
nav_order: 96
parent: Modules
---

## gg-static overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgStatic (class)](#ggstatic-class)
    - [registerConsoleCommand (method)](#registerconsolecommand-method)
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

### registerConsoleCommand (method)

**Signature**

```ts
public registerConsoleCommand(
    world: GgWorld<any, any> | null,
    command: string,
    handler: (...args: string[]) => Promise<string>,
    doc?: string,
  ): void
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
consoleCommands: any
```
