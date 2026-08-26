---
name: gg-engine-core-development
description: Modify packages/core of gg-web-engine — the dimension-agnostic and 2D/3D abstract interfaces, entities, math, and world classes that every rendering/physics adapter implements. Use when the task touches packages/core itself, not app code or a specific adapter package.
---

# Developing packages/core

`packages/core` (`@gg-web-engine/core`) has **no rendering or physics library dependency** — it
only defines abstractions (interfaces, generics, math, entity/world plumbing) that adapter
packages (`packages/three`, `packages/pixi`, `packages/ammo`, `packages/matter`,
`packages/rapier2d`, `packages/rapier3d`) implement. Treat it as the contract layer: changes here
ripple into every adapter and every app.

## Layout

```
src/base/    dimension-agnostic: IComponent, IEntity, clocks, math (Point2/3, Quaternion,
             Matrix4, Box, splines), inputs, GgWorld base class, body-options base
src/2d/      2D specialization: Gg2dWorld, Entity2d, 2D components/interfaces, 2D shapes
src/3d/      3D specialization: Gg3dWorld, Entity3d, 3D components/interfaces, 3D shapes,
             loaders, controllers (camera/car/free-fly), GgCarEntity, MapGraph3dEntity
src/dev/     in-page console + debugger UI, performance meter
```

Each of `base/2d/3d` mirrors the same sub-structure: `components/{physics,rendering}`,
`entities/`, `interfaces/`, `models/`. When adding a concept to 3D, check whether it belongs in
`base/` instead (dimension-agnostic) before duplicating it into both `2d/` and `3d/`.

## The TypeDocRepo generic pattern — read this before touching interfaces

Core interfaces don't hardcode adapter types. Instead each dimension defines a "type doc
repository" — a plain type mapping role names to the types an adapter must supply — and every
interface is generic over it:

```typescript
// packages/core/src/2d/gg-2d-world.ts
export type VisualTypeDocRepo2D = {
  factory: IDisplayObject2dComponentFactory;
  displayObject: IDisplayObject2dComponent;
  renderer: IRenderer2dComponent;
  rendererExtraOpts: {};
  camera: ICamera2dComponent;
  texture: unknown;
};
export type PhysicsTypeDocRepo2D = {
  factory: IPhysicsBody2dComponentFactory;
  rigidBody: IRigidBody2dComponent;
  trigger: ITrigger2dComponent;
};
```

`IVisualSceneComponent<D, R, VTypeDoc>`, `IPhysicsWorldComponent<D, R, PTypeDoc>`, etc. are generic
over these repos with a default equal to the base (unbound) interface. An adapter package
instantiates concrete versions (e.g. `ThreeVisualTypeDocRepo`, `Rapier2dPhysicsTypeDocRepo` in its
own `types.ts`) and implements the interfaces parametrized with them. `Gg2dWorldTypeDocRepo` /
`Gg3dWorldTypeDocRepo` combine a `vTypeDoc` + `pTypeDoc` pair, with `...VPatch`/`...PPatch` utility
types letting an app specify only one side and utility types like `TypedGg2dWorld<VW, PW>` compose
a full app-level world type from an independently-typed visual world and physics world. **Don't
break this indirection** — e.g. never have a base interface reference a concrete adapter type
directly, and when adding a new capability to a component interface, add the new type to the
relevant `TypeDocRepo` rather than hardcoding it.

## Interfaces that are the actual public contract

Changing any of these is a breaking change for every adapter package — grep
`implements I<Name>` across `packages/*/src` before editing, and plan to update every hit:

- `IComponent`, `IWorldComponent` (base)
- `IPhysicsWorldComponent` / `IVisualSceneComponent` (+ 2D/3D specializations)
- `IRigidBodyComponent`, `ITriggerComponent`, `IBodyComponent` (+ 2D/3D)
- `IDisplayObjectComponent`, `IRendererComponent`, `ICameraComponent` (+ 2D/3D)
- `IRaycastVehicleComponent` (3D only)
- `IEntity`, `IRenderableEntity`, `IRendererEntity`
- The factory abstracts in `2d/factories.ts` / `3d/factories.ts`

## Math & helpers

`Point2`/`Point3`/`Point4` are plain `{x,y,...}` data objects (not classes) so any adapter's
native vector can satisfy them structurally. `Pnt2`/`Pnt3`/`Qtrn` (in `base/math/`) are static
helper namespaces (add, lerp, `O` origin constant, `lookAt`, etc.) operating on those plain shapes
— prefer extending these over introducing class-based vector types, to keep the structural-typing
story intact for adapters.

## Build & test

```bash
cd packages/core
npm install
npm run build   # runs `update-version` (regenerates src/version.ts from package.json) then tsc
npm test        # jest + ts-jest + jsdom
```

Never hand-edit `src/version.ts` — it's generated. Tests live under `test/`, mirroring `src/`
paths, with shared fakes in `test/mocks/` (`body.mock.ts`, `object.mock.ts`, `world.mock.ts`,
`raycast-vehicle.mock.ts`). New core logic should get a `.spec.ts` there, not in an adapter
package, unless it's genuinely adapter-specific behavior.

## Testing a core change against the adapters

This repo has no workspace tool (no lerna/pnpm-workspace) — packages are independently versioned
and linked locally via scripts in `etc/`:

```bash
bash etc/switch_libs_to_local_core.sh   # npm-links your local core build into all adapter packages
```

This is exactly what CI (`.github/workflows/tests.yml`) runs before building/testing every
adapter, so any core interface change should be validated the same way locally: run the script,
then `npm run build && npm test` inside each affected `packages/<adapter>` (or all of them, for an
interface-level change).

## Before starting non-trivial work

Skim `docs/tasks.md` and `milestones.md` — they're a maintained backlog of known architectural gaps
(non-null assertions to remove, rotation-composition FIXME in the 3D loader, DI/event-bus work,
etc.) and may already describe the exact task, its rationale, and acceptance criteria.
