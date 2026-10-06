---
title: core/base/inputs/world-input.ts
nav_order: 138
parent: Modules
---

## world-input overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [runWhileInputEnabled](#runwhileinputenabled)

---

# utils

## runWhileInputEnabled

Keeps inputs in step with a world's `inputEnabled`: calls `start` right away if input is enabled
and every time it is enabled again, `stop` every time it is disabled, until `until$` emits. An
input controller calls this from `onSpawned` (with its `_onRemoved$`) in place of starting its
`MouseInput`/`DirectionInput` directly, so it goes quiet whenever the world's input is switched
off - while another screen covers the game, say. Stopping the inputs for good when the controller
is removed stays the controller's own job.

**Signature**

```ts
export declare function runWhileInputEnabled(
  world: { inputEnabled$?: Observable<boolean> },
  until$: Observable<unknown>,
  start: () => void,
  stop: () => void
): void
```
