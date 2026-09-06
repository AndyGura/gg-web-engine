# gg-web-engine — agent guide

GG-Web-Engine is a modular, library-agnostic 2D/3D web game engine. `@gg-web-engine/core` defines
rendering/physics-agnostic abstractions; separate adapter packages (`packages/three`,
`packages/pixi` for rendering; `packages/ammo`, `packages/rapier2d`, `packages/rapier3d`,
`packages/matter` for physics) implement those abstractions against real third-party libraries.
Apps compose one visual + one physics adapter of matching dimensionality on top of core. See the
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
| [`gg-engine-core-development`](.claude/skills/gg-engine-core-development/SKILL.md) | Changing `packages/core` — the dimension-agnostic and 2D/3D interfaces every adapter implements. |
| [`gg-engine-visual-adapter`](.claude/skills/gg-engine-visual-adapter/SKILL.md) | Creating/modifying a rendering backend package (`packages/three`, `packages/pixi`, or a new one). |
| [`gg-engine-physics-adapter`](.claude/skills/gg-engine-physics-adapter/SKILL.md) | Creating/modifying a physics backend package (`packages/ammo`, `packages/rapier2d`, `packages/rapier3d`, `packages/matter`, or a new one). |
| [`gg-engine-examples`](.claude/skills/gg-engine-examples/SKILL.md) | Adding/updating a demo under `examples/`. |
| [`gg-engine-release`](.claude/skills/gg-engine-release/SKILL.md) | Cutting a coordinated multi-package release. |

A task can span more than one skill (e.g. "add a Jolt physics backend and a demo" needs
`gg-engine-physics-adapter` then `gg-engine-examples`) — load each in sequence as you reach that
part of the work.

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

`gg-engine-core-development`, `gg-engine-visual-adapter`, `gg-engine-physics-adapter`,
`gg-engine-examples`, and `gg-engine-release` document *how to work on this repo*. Whenever work
under one of them hits a pitfall it doesn't mention, or something it says turns out to be
wrong/incomplete and you had to find the real fix, update that skill's `SKILL.md` with the lesson
before finishing the task — a short note on what went wrong, why, and the fix, folded into the
relevant section rather than dumped as an unstructured log. This applies whether you're doing the
work directly or reviewing a subagent's — if a subagent you spawned hits and solves one of these,
have it (or do it yourself) fold the lesson into the skill file as part of finishing, since the
next agent to touch that package starts from the skill file alone and won't have this
conversation's context.

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
- `docs/tasks.md` and `milestones.md` at the repo root track known architectural gaps and the
  public roadmap — check them before assuming a rough edge you find is unintentional/unknown.
