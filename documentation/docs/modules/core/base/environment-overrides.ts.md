---
title: core/base/environment-overrides.ts
nav_order: 131
parent: Modules
---

## environment-overrides overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [applyEnvironmentOverride](#applyenvironmentoverride)
  - [removeEnvironmentOverride](#removeenvironmentoverride)

---

# utils

## applyEnvironmentOverride

Applies `environment` to `scene` on behalf of `owner`, until `removeEnvironmentOverride` is
called for the same owner. Several owners can override the same scene at once and be removed in
any order: each field shows the newest remaining override that sets it, or the value it had
before any override once none is left.

**Signature**

```ts
export declare function applyEnvironmentOverride<E extends object>(
  scene: EnvironmentScene<E>,
  owner: object,
  environment: Partial<E>
): void
```

## removeEnvironmentOverride

Removes the override `owner` applied to `scene`; a no-op if it has none.

**Signature**

```ts
export declare function removeEnvironmentOverride<E extends object>(scene: EnvironmentScene<E>, owner: object): void
```
