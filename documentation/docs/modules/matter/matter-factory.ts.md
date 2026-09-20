---
title: matter/matter-factory.ts
nav_order: 138
parent: Modules
---

## matter-factory overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MatterFactory (class)](#matterfactory-class)
    - [createRigidBody (method)](#createrigidbody-method)
    - [createTrigger (method)](#createtrigger-method)
    - [transformOptions (method)](#transformoptions-method)

---

# utils

## MatterFactory (class)

**Signature**

```ts
export declare class MatterFactory {
  constructor(protected readonly world: MatterWorldComponent)
}
```

### createRigidBody (method)

**Signature**

```ts
createRigidBody(
    descriptor: BodyShape2DDescriptor,
    transform?: {
      position?: Point2;
      rotation?: number;
    },
  ): MatterRigidBodyComponent
```

### createTrigger (method)

**Signature**

```ts
createTrigger(
    descriptor: Shape2DDescriptor,
    transform?: {
      position?: Point2;
      rotation?: number;
    },
  ): MatterTriggerComponent
```

### transformOptions (method)

matter-js's own body model only has `isStatic` - no distinct kinematic body type (position-
driven, but still pushes/wakes dynamic bodies it moves into) and no continuous collision
detection at all, at any level. Both are long-standing, documented upstream limitations, not
something this adapter package failed to wire up - see `BodyOptions.kinematic_pos`/
`ccd`'s own doc in `packages/core` for what each is supposed to do.

`kinematic_pos`/`kinematic_vel` fall back to `isStatic: true` - the closest matter-js has - so
a caller gets _a_ body rather than a thrown error, but with the exact same caveat as
teleporting a `static` body's position by hand (see that doc): resting bodies on top won't be
pushed or woken correctly. `ccd: true` is silently accepted as a no-op beyond the warning below -
a fast-moving or fast-driven body can still tunnel clean through thin geometry in one step.

**Signature**

```ts
private transformOptions(options: Partial<Body2DOptions>): IChamferableBodyDefinition
```
