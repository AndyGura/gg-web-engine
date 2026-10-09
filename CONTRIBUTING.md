# Contributing to GG-Web-Engine

Thanks for your interest in the engine. This document is the human-facing guide to working on the
repository itself: how it's laid out, how to build and test it, what a pull request should look
like, and how a release is cut. It's written so that someone other than the current maintainer can
do all of that without tribal knowledge.

If you want to *build a game on top of* the engine rather than change the engine, you don't need
this file — start from the root [`README.md`](README.md) quickstart instead.

The same information, in more operational detail, lives in the Claude Code skills under
[`.claude/skills/`](.claude/skills/) (see [`CLAUDE.md`](CLAUDE.md) for the index). Those files are
written for an AI coding agent working in this repo; this one is for people. When the process
changes, both must be updated together so they don't drift apart.

## Table of contents

- [Ways to contribute](#ways-to-contribute)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Building and testing](#building-and-testing)
- [Branching, commits, and pull requests](#branching-commits-and-pull-requests)
- [What a change must keep up to date](#what-a-change-must-keep-up-to-date)
- [Continuous integration](#continuous-integration)
- [Cutting a release (maintainers)](#cutting-a-release-maintainers)
- [Code of conduct and license](#code-of-conduct-and-license)

## Ways to contribute

- **Bug reports and feature requests** go to
  [GitHub Issues](https://github.com/AndyGura/gg-web-engine/issues). Please use the issue templates;
  a reproducible bug report with a StackBlitz link (every example under `examples/` can be opened
  there) is the fastest way to get something fixed.
- **Pull requests** are welcome for anything from a typo to a new physics backend. For a large
  change (a new adapter package, a new core abstraction, a breaking API change), open an issue
  first so the design can be discussed before you invest the time.
- **The roadmap** is [`milestones.md`](milestones.md). It lists what's planned, what's done, and
  what's deliberately out of scope. Check it before proposing a feature — it may already be
  tracked, or already rejected with a reason.

The project is an experimental, single-maintainer effort. Response times on issues and reviews are
best-effort.

## Repository layout

| Path | What it is |
|---|---|
| `packages/core` | `@gg-web-engine/core` — rendering- and physics-agnostic abstractions (worlds, entities, components, math, inputs, loaders). No third-party engine dependency. |
| `packages/three`, `packages/pixi` | Rendering adapters (3D via three.js, 2D via pixi.js). |
| `packages/ammo`, `packages/rapier3d` | 3D physics adapters (Bullet via ammo.js, Rapier). |
| `packages/matter`, `packages/rapier2d` | 2D physics adapters (matter-js, Rapier). |
| `packages/audio` | Web Audio API adapter. |
| `packages/multiplayer` | Shared-world P2P multiplayer (network controller, WebRTC mesh transport, Firebase/BroadcastChannel signaling). Its in-process harness runs on all four physics adapters. |
| `examples/` | Standalone demo apps, one directory per example under `examples/2d` and `examples/3d`. Each is an independent npm project so it stays cloneable into StackBlitz, and picks its physics backend at startup from a `?physics=` query parameter (its `backends.ts`), which is how the gallery page (`examples/index.html`) swaps backends in place. `examples/examples.json` is the registry the gallery, `build_examples.sh`/`deploy.sh` and the release script all read. |
| `e2e/` | End-to-end test harnesses that need more than a package (currently the Blender export round-trip). |
| `blender-addon/` | Blender extension that exports a scene as `.glb` + `.meta` for the 3D loader. Published alongside every engine release. |
| `etc/` | Shell scripts: the release pipeline (`publish_new_version.sh`) and the example-linking helpers. |
| `documentation/` | **Generated** API docs (docs-ts + mkdocs), rebuilt by the release job. Never edit the output by hand; the inputs `generate.sh`, `mkdocs.yml` and `landing.md` (the site's home page) are hand-maintained. `generate.sh` also writes the site's `llms.txt`/`llms-full.txt` via `etc/generate_agent_docs.mjs --llms`, from the app-development skill, `landing.md` and the `player-character` examples. |
| `.github/workflows/` | CI definitions (see [Continuous integration](#continuous-integration)). |
| `.claude/skills/` | Per-task guides for AI coding agents. Also the most detailed written record of how each package works internally. |
| `milestones.md` | Public roadmap with per-deliverable status. |
| `CHANGELOG.md` | Release history, one section per published version. |

Every 3D world in this engine is **Z-up** (`{x, y}` is the ground plane, `+Z` is up), across core,
every adapter, and every example. Adapters re-orient Y-up-native primitives internally, so you
never compensate for it in engine-level code.

## Prerequisites

- **Node.js 24.x** and npm (the version CI uses; other recent LTS releases generally work too).
- **TypeScript 6.x** is pinned in the root `package.json` — don't bump it to 7 until `ts-jest`
  supports the native compiler.
- Optional, only if you touch these areas:
  - **Blender 4.2+** on your `PATH`, for `blender-addon/` and the `e2e/blender-export` test.
  - **Docker**, to rebuild the vendored ammo.js binary under `packages/ammo/build_gg_ammo/`. This
    is a rare, reviewed operation with its own workflow (`build_ammo.yml`); a normal build never
    needs it.

## Building and testing

`packages/*` is an npm workspace. One install at the repo root links every adapter's
`@gg-web-engine/core` dependency to the local `packages/core` build instead of the published
version, so your core changes are exercised by every adapter's real test suite.

```bash
npm install          # one-time: installs and links the packages/* workspace
npm run build        # full build of every package, core first (includes non-TS asset copies)
npm test             # jest suites of every package
npm run lint:examples  # examples use @gg-web-engine/* APIs and packages only, on every physics backend
npm run build:watch  # tsc -b --watch at the root — rebuilds core + adapters on every save
```

Notes:

- `npm run build` and `npm run build:watch` keep separate incremental caches. Run a full
  `npm run build` once first (it copies ammo's WASM glue into `dist/`, which `tsc -b` doesn't do),
  then iterate with `build:watch`.
- To work inside a single package, `cd packages/<name>` and use its own `npm run build`,
  `npm test`, and `npm run prettier-format` scripts. The root `npm test` runs every package's
  suite in turn.
- Tests live under each package's `test/`, mirroring `src/`. New core logic gets a `.spec.ts` in
  `packages/core/test`; adapter-specific behavior gets one in that adapter's own `test/`.
- Never hand-edit `packages/core/src/version.ts` — it's regenerated from `package.json` on every
  build.
- `npm run clean` (`tsc -b --clean`) removes the incremental build outputs if a stale
  `dist/` is confusing you.

### Formatting

Code is formatted with Prettier using the root `.prettierrc`. `npm run prettier-format` at the
root formats every package; the release pipeline also runs it, so unformatted code will show up
as an unrelated diff in the next release commit if you skip it.

### Seeing a change in a running example

Examples are deliberately *not* part of the workspace. Link one to your local package builds,
then start its dev server:

```bash
bash etc/switch_example_to_local_gg.sh examples/3d/<example-dir>
cd examples/3d/<example-dir> && npm start     # webpack-dev-server
```

With `npm run build:watch` and the example's dev server both running, any edit under
`packages/*/src` shows up in the browser without another step. Undo the link with
`bash etc/restore_example_from_local_gg.sh examples/3d/<example-dir>`. The
`gg-engine-core-development` skill documents caveats of this loop in detail. Append
`?physics=<backend>` to the dev server's URL to run the example on another physics backend; the
gallery page itself can be previewed against local `dist/` builds with
`node examples/serve_gallery.mjs`.

### The Blender export end-to-end test

`e2e/blender-export` builds a fixture scene in Blender, exports it with the add-on, and loads it
back through a real `Gg3dWorld`. It needs a `blender` binary on `PATH`; see its own
[`README.md`](e2e/blender-export/README.md) for how to run it locally.

## Branching, commits, and pull requests

- `main` is the only long-lived branch. It must always build and pass tests, because a release
  is cut straight from it.
- Work on a topic branch. The names in use are `feature/<topic>`, `fix/<topic>`, and
  `upgrade/<topic>` (for dependency bumps); anything descriptive is fine.
- Open a pull request against `main`. The PR template lists the checks a change is expected to
  pass; fill it in rather than deleting it.
- PRs are **squash-merged**. The PR title becomes the commit subject on `main`, so write it as
  the one-line summary you'd want to read in `git log` (and in the changelog). Details go in the
  PR description.
- **Never start a commit subject with `[pre-release] [X.Y.Z]`** unless you are cutting a
  release. That exact prefix, on `main`, is what triggers the publish pipeline (see
  [Cutting a release](#cutting-a-release-maintainers)).
- Keep a PR to one logical change. A change that touches `packages/core` *and* several adapters
  is fine when it's one interface change propagated everywhere; a PR that bundles unrelated fixes
  is harder to review and to describe in the changelog.
- CI must be green before merge. If a check fails on something unrelated to your change, say so
  in the PR — don't work around it silently.

## What a change must keep up to date

The repository keeps several pieces of documentation that describe the code's *current* behavior.
A change that alters behavior without updating them is incomplete.

- **`CHANGELOG.md`** — add a line under `## [Unreleased]` for any user-visible change (new
  feature, behavior change, bug fix, dependency bump that affects consumers). Internal refactors
  and doc-only changes don't need an entry.
- **`milestones.md`** — if your change completes or advances a deliverable already listed there,
  update that bullet's status in place (with the date). Don't add new deliverables or milestones
  on your own initiative; that's the maintainer's call. Bug fixes don't belong there at all.
- **The skill files under `.claude/skills/`** — if you changed how a package is built, how an
  interface works, or hit a pitfall the relevant skill doesn't mention, update it. Describe the
  code as it is now, not the diff you just made.
- **This file and the root `README.md`** — if you changed the build, test, or release process,
  or the quickstart API shown in the README.
- **`packages/core/AGENTS.md`** — generated from
  `.claude/skills/gg-engine-app-development/SKILL.md` and shipped in the core npm package for
  coding agents. If you edit that skill, run `npm run agents-md` and commit the result; CI
  (`npm run check:agents-md`) fails when they differ. Never edit `AGENTS.md` by hand.
- **Never** `documentation/`'s generated output. It's regenerated at release time. Its home page is
  `documentation/landing.md`: keep its pitch and install lines in step with the README.

Conventions the review will check for:

- Every concrete entity class declares `static readonly entityTypeName: string = 'ClassName';`.
  It gives instances a readable auto-generated name that survives minification.
- A new adapter package is wired into: the `libs` array in `etc/publish_new_version.sh`, the root
  `tsconfig.json` `references`, and (for a physics/visual adapter) the matching skill's file
  layout conventions. Without the first of those it is silently excluded from releases. Its
  `devDependencies` never list other `@gg-web-engine/*` adapter packages (the release installs each
  package standalone, and the previous adapter release would conflict with the new core); tests
  that need adapters resolve them through the workspace instead.
- A new example is added to `examples/examples.json` (the gallery lists it from there, and the
  build, deploy and release scripts iterate it), under `examples/2d` or `examples/3d`.
- Examples use `@gg-web-engine/*` APIs only: no direct `three`/`pixi.js`/`ammo.js`/`matter-js`/
  `@dimforge/*` import and no `native*` escape hatch (`nativeMesh`, `nativeSprite`, `nativeBody`,
  ...). Their `package.json` lists `@gg-web-engine/*` packages only (each adapter brings its
  library), nothing stubs Node built-ins for Ammo, and every example runs on every physics adapter
  of its dimension (`examples.json`). `npm run lint:examples` checks all of this. If an example
  needs something core can't express,
  add the option to core and the adapters instead. A line that deliberately demonstrates native
  interop can opt out with a trailing `// gg-allow-native` comment.
- Unit tests for new core or adapter logic, in the package that owns the behavior.

## Continuous integration

| Workflow | Runs when | Does |
|---|---|---|
| `pull_request_build.yml` | every PR | `npm install`, `npm run build`, `npm test` at the root — every package, against the local core build — then `npm run lint:examples` and `npm run check:agents-md`. |
| `blender_export_e2e.yml` | PRs touching `blender-addon/`, `e2e/blender-export/`, `packages/core/src/3d/`, `packages/three/`, `packages/rapier3d/`; or manually | Installs Blender and runs the export round-trip test. |
| `build_ammo.yml` | PRs touching `packages/ammo/build_gg_ammo/`; or manually | Rebuilds the vendored ammo.js binary from source and runs ammo's tests against it. On manual dispatch, commits the refreshed binary back to the branch. |
| `release_action.yml` | every push to `main` | No-op unless the commit subject matches `[pre-release] [X.Y.Z]`; otherwise runs the full release described below. |

## Cutting a release (maintainers)

All `@gg-web-engine/*` packages ship **together, at one version number**. Adapters pin an exact
`@gg-web-engine/core` version, so there is no independent per-package versioning. The Blender
add-on is published by the same job but keeps its own version number in
`blender-addon/blender_manifest.toml`; bump that (and `bl_info["version"]`) yourself only when
the add-on actually changed.

### Steps

1. Make sure `main` is green and every change you want in the release is merged.
2. Check `CHANGELOG.md` is in the shape the pipeline expects: exactly two `[Unreleased]` markers
   in the whole file (the `## [Unreleased]` heading and the `[Unreleased]: .../compare/<prev>...HEAD`
   link at the bottom), and the new version not mentioned anywhere yet. Don't roll the section
   by hand — the job does it. If the section is empty (a rebuild-only release such as a CI fix),
   add a one-line note under it saying what the release re-publishes and why, so the version
   sequence in the file stays gap-free except for genuinely failed attempts.
3. Commit on `main` with the subject **`[pre-release] [X.Y.Z] <short description>`** and push.
   The version must be a plain `MAJOR.MINOR.PATCH`. Nothing in the repo needs to be edited by
   hand for the version bump — the pipeline does it. The commit can be empty
   (`git commit --allow-empty`) if there's nothing else to land.
4. Watch the `Release new version` job in GitHub Actions. On success it has:
   - rolled `CHANGELOG.md` (`etc/roll_changelog.sh`): renamed `## [Unreleased]` to
     `## [X.Y.Z] - <today>` under a fresh empty `## [Unreleased]`, turned the `[Unreleased]`
     compare link into `[X.Y.Z]: .../compare/<prev>...X.Y.Z` and added a new
     `[Unreleased]: .../compare/X.Y.Z...HEAD` above it. This is the first step after the version
     is parsed, so a malformed changelog fails the job before anything is built or published;
   - checked `packages/core/AGENTS.md` matches the app-development skill, then built and tested
     everything from a workspace install as a preflight;
   - bumped `packages/core`, published it, and waited for npm to serve the new version;
   - bumped every adapter's own version and its `@gg-web-engine/core` dependency, built each one
     against the *published* core (not the workspace symlink), and published them;
   - bumped `@gg-web-engine/*` versions in every example listed in `examples/examples.json`, and
     that file's `version` (the git tag the gallery's StackBlitz links open);
   - regenerated `documentation/`, committed all of the above (the rolled changelog included) back to `main` as
     `X.Y.Z release`, tagged it `X.Y.Z`, and deployed the docs site plus the Blender extension
     repository to GitHub Pages.
5. Do the manual follow-ups the job doesn't cover:
   - confirm the code sample in the root `README.md` quickstart still matches the current API;
   - rebuild and redeploy the examples gallery (`examples/build_examples.sh`, then
     `examples/deploy.sh`);
   - spot-check that the gallery's StackBlitz links open at the new tag.

### If a release fails partway

`npm publish` refuses to re-publish a version that already exists, so **don't retry the same
version number**. Fix the cause, then cut the next attempt as `[pre-release] [X.Y.(Z+1)]`.
Packages that did publish at the failed version are harmless leftovers on npm. The gaps in the
tag history (e.g. `0.0.41`–`0.0.47`, `0.0.67`–`0.0.69`) are exactly this.

The `gg-engine-release` skill records the pipeline's known failure modes (first-time publish of a
new package, `set -e` and `&&`-chains, npm propagation timing) and should be read in full before
changing `etc/publish_new_version.sh` or `release_action.yml`.

## Code of conduct and license

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating you agree
to uphold it.

GG-Web-Engine is licensed under the [Apache License 2.0](LICENSE). By submitting a contribution
you agree that it is licensed under the same terms, as described in section 5 of that license.
