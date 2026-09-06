---
title: core/base/entities/group.entity.ts
nav_order: 83
parent: Modules
---

## group.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GroupEntity (class)](#groupentity-class)
    - [tickOrder (property)](#tickorder-property)

---

# utils

## GroupEntity (class)

A trivial entity with no rendering/physics of its own: it exists purely as a parent/grouping
node. `LevelLoader.loadLevel`/`loadLevelFromUrl` hand one back for every loaded level - every
entity the level's JSON produced is added as one of its children (see `IEntity.addChildren`),
so the whole level can be torn down in a single call:
`world.removeEntity(level, true)` cascades removal + disposal to every child
(see `IEntity.onRemoved`/`dispose`). Also used internally to group the several entities a single
multi-piece GLB load can produce under one name (see the built-in `"Glb"` level entity class).

**Signature**

```ts
export declare class GroupEntity<D, R, TypeDoc>
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: TickOrder.OBJECTS_BINDING
```
