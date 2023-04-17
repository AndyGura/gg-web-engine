---
title: core/base/ui/gg-console.ui.ts
nav_order: 68
parent: Modules
---

## gg-console.ui overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgConsoleUI (class)](#ggconsoleui-class)
    - [createUI (method)](#createui-method)
    - [destroyUI (method)](#destroyui-method)
    - [onUsePreviousCommand (method)](#onusepreviouscommand-method)
    - [onUseNextCommand (method)](#onusenextcommand-method)
    - [onInput (method)](#oninput-method)
    - [stdout (method)](#stdout-method)
    - [setupDragging (method)](#setupdragging-method)
    - [elements (property)](#elements-property)

---

# utils

## GgConsoleUI (class)

**Signature**

```ts
export declare class GgConsoleUI {
  private constructor()
}
```

### createUI (method)

**Signature**

```ts
public createUI()
```

### destroyUI (method)

**Signature**

```ts
public destroyUI()
```

### onUsePreviousCommand (method)

**Signature**

```ts
onUsePreviousCommand()
```

### onUseNextCommand (method)

**Signature**

```ts
onUseNextCommand()
```

### onInput (method)

**Signature**

```ts
async onInput()
```

### stdout (method)

**Signature**

```ts
private stdout(s: string = ''): void
```

### setupDragging (method)

**Signature**

```ts
setupDragging()
```

### elements (property)

**Signature**

```ts
elements: { main: HTMLDivElement; input: HTMLInputElement; output: HTMLTextAreaElement; } | null
```
