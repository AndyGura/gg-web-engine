---
title: core/base/interfaces/i-serializable-entity.ts
nav_order: 123
parent: Modules
---

## i-serializable-entity overview

Opt-in capability letting an entity class own its own `EntityJson` serialization, instead of
`LevelLoader.serializeEntity` having to reverse-engineer it from outside the class (a
spawn-record echo of whatever `config` the entity happened to be built with, or a bespoke
`LiveEntitySerializer`/`EntitySerializer` registered against the loader). Implement this
directly on any entity class - built-in or app-defined - whose spawn descriptor needs data
beyond `serializeEntity`'s own generic handling of `class`/`name`/live `position`/`rotation`:
custom construction settings (a vehicle's engine/transmission tuning), and/or runtime-mutated
state a spawn-time `config` alone could never reflect (that same vehicle's current gear/
throttle/steering) - both belong in the entity class itself, since it's the only place that
actually owns that state and the only place guaranteed to stay in sync with it as the class
evolves.

`serializeSettings()` is called fresh every time `LevelLoader.serializeEntity` runs on a
matching entity - never cached - so it always reflects whatever the entity's state happens to
be at call time, not just what it was constructed with. `serializeEntity` still owns resolving
the `class` alias this plugs into (from the entity's own spawn record if it was built via
`createEntity`/`loadLevel`, or from the constructor->alias mapping an optional third
`LevelLoader.registerClass` argument sets up for an entity built some other way) and the generic
`name`/live `position`/`rotation` fields every `EntityJson` carries - an implementer only
returns its own `shape`/`config` contribution, the same two fields a hand-authored level JSON
entity would carry for this class.

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ISerializableEntity (interface)](#iserializableentity-interface)
  - [isSerializableEntity](#isserializableentity)

---

# utils

## ISerializableEntity (interface)

Opt-in capability letting an entity class own its own `EntityJson` serialization, instead of
`LevelLoader.serializeEntity` having to reverse-engineer it from outside the class (a
spawn-record echo of whatever `config` the entity happened to be built with, or a bespoke
`LiveEntitySerializer`/`EntitySerializer` registered against the loader). Implement this
directly on any entity class - built-in or app-defined - whose spawn descriptor needs data
beyond `serializeEntity`'s own generic handling of `class`/`name`/live `position`/`rotation`:
custom construction settings (a vehicle's engine/transmission tuning), and/or runtime-mutated
state a spawn-time `config` alone could never reflect (that same vehicle's current gear/
throttle/steering) - both belong in the entity class itself, since it's the only place that
actually owns that state and the only place guaranteed to stay in sync with it as the class
evolves.

`serializeSettings()` is called fresh every time `LevelLoader.serializeEntity` runs on a
matching entity - never cached - so it always reflects whatever the entity's state happens to
be at call time, not just what it was constructed with. `serializeEntity` still owns resolving
the `class` alias this plugs into (from the entity's own spawn record if it was built via
`createEntity`/`loadLevel`, or from the constructor->alias mapping an optional third
`LevelLoader.registerClass` argument sets up for an entity built some other way) and the generic
`name`/live `position`/`rotation` fields every `EntityJson` carries - an implementer only
returns its own `shape`/`config` contribution, the same two fields a hand-authored level JSON
entity would carry for this class.

**Signature**

```ts
export interface ISerializableEntity {
  /**
   * @returns This entity's own `shape`/`config` contribution to its `EntityJson`, reflecting its
   * current live state. Both are optional - a class with nothing beyond the generic envelope can
   * return `{}`, though at that point it likely doesn't need to implement this interface at all.
   */
  serializeSettings(): { shape?: string; config?: Record<string, any> }
}
```

## isSerializableEntity

Type guard for {@link ISerializableEntity} - checks for the one method that distinguishes a
self-serializing entity from an ordinary one, since the capability is opt-in. Prefer this over
an `instanceof` check against a concrete class.

**Signature**

```ts
export declare function isSerializableEntity(entity: unknown): entity is ISerializableEntity
```
