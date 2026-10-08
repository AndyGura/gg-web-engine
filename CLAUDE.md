# gg-web-engine — agent guide

GG-Web-Engine is a modular, library-agnostic 2D/3D web game engine. `@gg-web-engine/core` defines
rendering/physics-agnostic abstractions; separate adapter packages (`packages/three`,
`packages/pixi` for rendering; `packages/ammo`, `packages/rapier2d`, `packages/rapier3d`,
`packages/matter` for physics) implement those abstractions against real third-party libraries.
Apps compose one visual + one physics adapter of matching dimensionality on top of core. Optional
add-on packages (`packages/audio`, `packages/multiplayer`, `packages/mobile-controls`) plug into the
same world. See the
root `README.md` for the full pitch and a quickstart code sample.

## Skill set

This repo ships Claude Code skills under `.claude/skills/`, one per distinct kind of work on this
engine. They are auto-discovered by Claude Code in any session opened at this repo root — you
don't need to do anything special to have them show up in your own context. Pick the one matching
the task before writing code:

| Skill | Use for |
|---|---|
| [`gg-engine-app-development`](.claude/skills/gg-engine-app-development/SKILL.md) | Writing app/game code that *consumes* published `@gg-web-engine/*` packages. |
| [`gg-engine-level-json`](.claude/skills/gg-engine-level-json/SKILL.md) | Authoring a level/scene JSON file, or registering an app-defined entity class the loader can dispatch to. |
| [`gg-engine-core-development`](.claude/skills/gg-engine-core-development/SKILL.md) | Changing `packages/core` — the dimension-agnostic and 2D/3D interfaces every adapter implements. Also covers `packages/mobile-controls` (on-screen touch controls), which builds on core's input classes. |
| [`gg-engine-visual-adapter`](.claude/skills/gg-engine-visual-adapter/SKILL.md) | Creating a **new** rendering backend package from scratch, or the general contract any visual adapter must satisfy. |
| [`gg-engine-visual-adapter-three`](.claude/skills/gg-engine-visual-adapter-three/SKILL.md) | Fixing/extending the already-implemented `packages/three` adapter specifically — known three.js pitfalls (Z-up re-orientation, ESM-only jest setup, …). |
| [`gg-engine-visual-adapter-pixi`](.claude/skills/gg-engine-visual-adapter-pixi/SKILL.md) | Fixing/extending `packages/pixi` specifically — known `pixi.js` v8 pitfalls (no `Container.clone()`, ticker-free animation, `earcut` under jest, …). |
| [`gg-engine-audio-adapter`](.claude/skills/gg-engine-audio-adapter/SKILL.md) | Creating/modifying an audio backend package (`packages/audio`, or a new one), or the `audioScene` contract itself. |
| [`gg-engine-physics-adapter`](.claude/skills/gg-engine-physics-adapter/SKILL.md) | Creating a **new** physics backend package from scratch, or the general contract any physics adapter must satisfy. |
| [`gg-engine-physics-adapter-ammo`](.claude/skills/gg-engine-physics-adapter-ammo/SKILL.md) | Fixing/extending the already-implemented `packages/ammo` adapter specifically — known Bullet/embind pitfalls. |
| [`gg-engine-physics-adapter-rapier`](.claude/skills/gg-engine-physics-adapter-rapier/SKILL.md) | Fixing/extending `packages/rapier2d`/`packages/rapier3d` specifically — known `@dimforge/rapier-compat` pitfalls. |
| [`gg-engine-physics-adapter-matter`](.claude/skills/gg-engine-physics-adapter-matter/SKILL.md) | Fixing/extending `packages/matter` specifically — known `matter-js` pitfalls. |
| [`gg-engine-multiplayer`](.claude/skills/gg-engine-multiplayer/SKILL.md) | Working on `packages/multiplayer` (shared-world networking, WebRTC/signaling transports) or core's networking contracts (`INetworkSyncable`/`INetworkInputDriven`, correction helpers), or making an entity class network-aware. |
| [`gg-engine-examples`](.claude/skills/gg-engine-examples/SKILL.md) | Adding/updating a demo under `examples/`. |
| [`gg-engine-release`](.claude/skills/gg-engine-release/SKILL.md) | Cutting a coordinated multi-package release. |

A task can span more than one skill (e.g. "add a Jolt physics backend and a demo" needs
`gg-engine-physics-adapter` then `gg-engine-examples`) — load each in sequence as you reach that
part of the work. The three `gg-engine-physics-adapter-*` and two `gg-engine-visual-adapter-*`
skills hold implementation history for the already-shipped adapters (already-solved native-library quirks,
build/typing gotchas) and are only relevant once you're touching one of those specific packages —
building a brand-new adapter never needs them, only the general `gg-engine-physics-adapter` /
`gg-engine-visual-adapter` skill.

## Delegating this work to subagents

When splitting engine work across `Agent` calls (e.g. one agent per new adapter package, or a
research agent followed by an implementation agent), **name the skill explicitly in the spawned
agent's prompt and tell it to load the skill via the `Skill` tool first**. A fresh subagent starts
with an empty conversation; it sees the same auto-discovered skill listing you do, but nothing
forces it to pick the right one for an ambiguous-sounding task, and it has none of the
investigation this session already did. Concretely:

- Give each subagent a **narrow, single-skill scope** — one adapter package, one example, one core
  change — rather than "build the whole feature," so the skill file's guidance stays a tight match
  for what the agent is doing and its diff stays reviewable.
- State the skill name and the concrete deliverable up front, e.g.: *"Load the
  `gg-engine-physics-adapter` skill, then implement a new `packages/jolt` physics adapter package
  for 3D following that skill's file layout and conventions. Also wire it into CI and the release
  scripts as the skill describes."*
- For work that touches core **and** one or more adapters (an interface change), prefer doing the
  core change yourself (or in one agent) first, land/validate it, *then* spawn one
  `gg-engine-visual-adapter`/`gg-engine-physics-adapter` agent per affected package to update that
  package against the new interface — don't have multiple agents edit `packages/core` concurrently.
- Independent adapter packages (e.g. adding both a new visual and a new physics backend) are safe
  to parallelize across separate subagents, each loading the skill matching its own package.
- After any adapter-touching change, remind the agent (or do it yourself) to run `npm install` at
  the repo root so the package under test links against the local core build rather than the last
  published npm version — this is what CI does too, and skipping it hides breakage that only shows
  up against unreleased core changes. See `gg-engine-core-development` for the full local-dev
  workflow (workspace + `tsc -b --watch`).
- Use the `gg-engine-release` skill yourself (don't delegate a release to a subagent) — it's a
  short, high-stakes, strictly-ordered script run, not something that benefits from parallel
  agents, and it publishes to npm and GitHub Pages.

## Keep the repo-development skills current

`gg-engine-core-development`, `gg-engine-visual-adapter`, `gg-engine-visual-adapter-three`,
`gg-engine-visual-adapter-pixi`, `gg-engine-audio-adapter`, `gg-engine-physics-adapter`, `gg-engine-physics-adapter-ammo`,
`gg-engine-physics-adapter-rapier`, `gg-engine-physics-adapter-matter`, `gg-engine-multiplayer`,
`gg-engine-examples`, and
`gg-engine-release` document *how to work on this repo*. Whenever work under one of them hits a
pitfall it doesn't mention, or something it says turns out to be wrong/incomplete and you had to
find the real fix, update that skill's `SKILL.md` with the lesson before finishing the task — a
short note on what went wrong, why, and the fix, folded into the relevant section rather than dumped
as an unstructured log. This applies whether you're doing the work directly or reviewing a
subagent's — if a subagent you spawned hits and solves one of these, have it (or do it yourself)
fold the lesson into the skill file as part of finishing, since the next agent to touch that package
starts from the skill file alone and won't have this conversation's context. A lesson specific to
one already-implemented adapter (`ammo`/`rapier2d`/`rapier3d`/`matter`, `three`/`pixi`) belongs in that
library's own `gg-engine-physics-adapter-*` / `gg-engine-visual-adapter-*` skill, not in the
general `gg-engine-physics-adapter` / `gg-engine-visual-adapter` file — see each general file's own
"Keep this skill current" section for the split.

`CONTRIBUTING.md` at the repo root is the human-facing mirror of the process parts of
`gg-engine-core-development` (build/test/format commands, the example-linking loop) and
`gg-engine-release` (trigger commit, pipeline steps, failed-release recovery, manual follow-ups),
for a contributor not working through Claude Code. When a change alters that *process* - not a
package's internals, only how the repo is built, tested, reviewed, or released - update
`CONTRIBUTING.md` in the same change as the skill file, so the two never disagree.

This does **not** apply to `gg-engine-app-development` or `gg-engine-level-json`: lessons learned
while building an end-application (or authoring its level JSON content) on top of the engine
belong in that app's own codebase/docs, not in this engine repo's skill set. `gg-engine-level-json`
itself should still be kept current for lessons about the loader mechanism/built-in classes
themselves — see that file's own "Keep this skill current" section.

Whenever you edit any skill file (not just these five) to reflect a change you just made, describe
the resulting API/behavior as it stands now — don't narrate the change itself ("X used to return Y,
now it returns Z", "there is no longer a `.foo` property"). A skill file is read fresh by an agent
who never knew the old shape, so that framing is pure noise to them, not context. Overwrite the
stale paragraph outright instead of appending a delta next to it. Save the actual history for
`milestones.md`'s changelog-style status entries, where a "what changed and why" narrative is the
point.

## Non-obvious repo facts worth knowing before diving in

- **Every 3D world in this engine is Z-up, always** — `{x, y}` is the ground plane, `+Z` is up. This
  is true across core, every adapter (three, ammo, rapier3d), and every example; there is no
  per-app/per-world configuration to change it. Concretely: `packages/three/src/three-factory.ts`
  and adapters' factories internally re-orient any Y-up-native primitive (three.js's own
  `CapsuleGeometry`/`CylinderGeometry`/`ConeGeometry`, Bullet/Rapier default conventions) so the
  engine-level shape/body APIs are Z-up-consistent; you should never need to compensate for Y-up
  yourself when calling them. When writing a raw `Point3`/`{x,y,z}` literal that's meant to be a
  world axis or up-vector (not an arbitrary position), prefer the named constants in `Pnt3` (`Pnt3.X`
  = `{x:1,y:0,z:0}`, `Pnt3.Y`, `Pnt3.Z` = "up", and `Pnt3.nX`/`Pnt3.nY`/`Pnt3.nZ` for their negatives)
  over spelling the components out — it documents intent and avoids sign/axis mistakes. 2D worlds
  (`packages/pixi`, `packages/matter`, `packages/rapier2d`) are the ordinary `{x, y}` screen/ground
  plane and aren't affected by this (no Z axis at all) — `Pnt2` still has its own 2D analogs
  (`Pnt2.X`/`Pnt2.Y`/`Pnt2.nX`/`Pnt2.nY`) for the same reason, there's just no `Z`/`nZ`.
- Every package under `packages/` and `examples/` is versioned and published independently (see
  `gg-engine-release`) — there's no lockstep-versioned monorepo tool (no lerna/pnpm). Locally,
  though, `packages/*` (not `examples/*`) *is* an npm workspace (root `package.json`) purely for
  dev-time resolution: `npm install` at the repo root symlinks every adapter's
  `@gg-web-engine/core` dependency to the local `packages/core` instead of fetching it from npm.
  Examples stay outside the workspace on purpose (they need to remain standalone-cloneable for
  StackBlitz) and use `etc/switch_example_to_local_gg.sh` instead. See
  `gg-engine-core-development` for the full local-dev workflow, including the `tsc -b --watch`
  loop that rebuilds core and every adapter incrementally as you edit.
- All `@gg-web-engine/*` packages are released together at one version number (see
  `gg-engine-release`); adapters pin exact versions of both `@gg-web-engine/core` and their
  underlying third-party library.
- `milestones.md` at the repo root tracks known architectural gaps and the public roadmap — check
  it before assuming a rough edge you find is unintentional/unknown.
- `CHANGELOG.md` at the repo root is hand-maintained in Keep-a-Changelog format: any user-visible
  change (new API, behavior change, bug fix, consumer-affecting dependency bump) gets a line under
  `## [Unreleased]` as part of the same PR; the `[pre-release] [X.Y.Z]` release commit rolls that
  section into a versioned one (see `gg-engine-release`). Internal refactors and doc-only changes
  don't get an entry.
- `documentation/` (API docs, including `documentation/site`) is generated by typedoc as part of
  `gg-engine-release`'s publish flow, not hand-maintained — never edit files under it for a source
  change (a rename, a new type, updated JSDoc); it's regenerated wholesale at the next release.
  The generator's inputs are the exception and are edited by hand: `generate.sh`, `mkdocs.yml`
  and `landing.md` (the docs site's home page, copied over the generated stub by `generate.sh`).
- **`GgStatic` and everything under `packages/core/src/dev` is a debug-only shadow API** (dev
  console, debugger panel, stats), not part of the engine proper. Three consequences:
  - Engine code (`packages/*/src` outside `core/src/dev`) never imports or references it, so the
    app's own import is the only thing that can pull it into a build. Engine code talks to it
    solely through `window.ggstatic`, and only when that exists - the way `GgWorld` registers its
    console commands (immediately if `window.ggstatic` is there, otherwise on the `ggstatic_added`
    window event).
  - No public API may live on `GgStatic` or depend on it. New APIs go on the world, its loader, or
    an adapter; a console command is an extra way to reach such an API, never the only one.
  - An app may import it to get the console and debugger during development. It is not meant for a
    production build - the console can spawn, teleport and retune anything, i.e. cheat.
- **Every concrete entity class — engine-internal or app-defined — must declare `static readonly
  entityTypeName: string = 'ClassName';`.** This is a stable, class-identifying string used to give
  every one of that class's instances a readable auto-generated default name (see below); it's
  deliberately not derived from `constructor.name`/`Function.name`, which a production bundler
  commonly mangles under minification - anything keying off the class's real runtime name would get
  different, meaningless values between a dev build and a production build. Concretely, it's what
  makes an entity's auto-generated default name (used whenever nothing explicitly assigns `.name`)
  read as `ClassName_0` in the dev console and in logs, instead of an opaque `e0x7`. Check for it on
  any new entity class you write or review, in this repo (`gg-engine-core-development`'s own section
  on this) or in a consuming app (`gg-engine-app-development`'s). It is a separate mechanism from
  `LevelLoader`'s JSON round-trip (`loadLevel`/`createEntity` to build, `serializeEntity`/
  `serializeLevel` to reconstruct an `EntityJson` from a live entity - see `gg-engine-level-json`'s
  own section on this): neither of `serializeEntity`'s two mechanisms - a live serializer matching an
  entity's exact concrete class, or the spawn-record echo keyed off the `class` alias an entity was
  built under via the loader - ever reads `entityTypeName`, so it remains purely a naming
  convenience, not load-bearing for serialization either way.
