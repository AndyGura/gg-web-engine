---
title: core/base/logging.ts
nav_order: 113
parent: Modules
---

## logging overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [warnOnce](#warnonce)

---

# utils

## warnOnce

`console.warn(message, ...optionalParams)`, but only the first time this exact `message` string
is seen - every later call with the same `message` is a silent no-op, regardless of
`optionalParams` (e.g. a per-call error object, only ever printed alongside that first log).
Dedup is keyed purely on `message`, process-wide (not per-instance/per-world) and forever (no
expiry) - callers that legitimately want the warning to reappear later (e.g. once per level
load) need to key their own message string accordingly (include something that changes), since
this helper has no way to know that on their behalf.

Meant for a warning that's cheap to trigger many times with an identical message from a hot path
(once per tick, once per trigger/event firing, once per entity in a loop) where a plain
`console.warn` at the call site would flood the console with the same line and teach a developer
to tune it out rather than fix the one thing worth fixing. Not meant for a warning that can only
ever fire once per process anyway, or where every occurrence carries genuinely distinct
information (a different entity name, a different id) - plain `console.warn` is more honest
there, since deduping on message text alone would silently drop that information.

**Signature**

```ts
export declare function warnOnce(message: string, ...optionalParams: unknown[]): void
```
