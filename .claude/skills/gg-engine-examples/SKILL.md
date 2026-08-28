---
name: gg-engine-examples
description: Add or update a demo project under examples/ in gg-web-engine (webpack demos, framework integration samples, or the StackBlitz gallery). Use when the task is to create a new example app, not general app development against a published engine version outside this repo.
---

# Adding an example project

`examples/` holds one small, focused demo per feature/combination — they double as manual
integration tests (rendering adapters have little automated testing, see
`gg-engine-visual-adapter`) and as the tutorials linked from the README/StackBlitz gallery.

## Pick a template

- **Plain webpack demo** (most examples): copy the nearest existing example with a matching
  visual+physics combination, e.g. `examples/primitives-three-ammo` or
  `examples/primitives-pixi-rapier2d`. Contains `index.html`, `index.ts`, `webpack.config.js`
  (prod build), `webpack.dev.config.js` (dev server), `tsconfig.json`, `package.json`.
- **Framework integration sample**: copy `examples/framework-angular-three-ammo` or
  `examples/framework-react-three-rapier3d` instead — these have framework-specific tooling and
  lifecycle wiring (create the world in `ngOnInit`/`useEffect`, dispose on teardown).

Naming convention: `<feature-or-topic>-<visual-lib>-<physics-lib>` (e.g.
`collision-groups-pool-three-rapier3d`, `glb-loader-three-ammo`). Physics-only or render-only demos
just omit the missing half.

## package.json

Pin `@gg-web-engine/*` and underlying library (`three`/`pixi.js`/rapier compat build) versions to
whatever `packages/core/package.json`'s current `version` is — examples are not meant to float on
version ranges. Copy the `browser` field (`{"fs": false, "os": false, "path": false}`) when the
physics lib is Ammo (needed to stub Node built-ins the WASM glue references).

## tsconfig `target`

Set `compilerOptions.target` in the example's `tsconfig.json` to `ES2020` (the value already used
by most examples) or higher — never `ES5` and never leave it unset (`tsc`'s default is lower
still). `packages/core` and every adapter are published compiled at `target: es2016`
(`tsconfig.base.json` at the repo root), which keeps real ES2015+ `class` syntax (native classes
aren't downleveled at that target, only newer syntax like async/await is). If an example compiles
*its own* code at `ES5`, `tsc`/`ts-loader` downlevels any `class ... extends <ImportedBaseClass>`
in the example (e.g. a custom entity extending `IEntity`, or `Gg3dWorld` itself if subclassed) into
the ES5 `__extends` helper, which calls the parent via `Base.call(this, ...)` instead of `new`.
Calling a real ES2015+ class without `new` throws `TypeError: Class constructor X cannot be invoked
without 'new'` at runtime — in a webpack production bundle this surfaces minified as `Class
constructor E cannot be invoked without 'new' at new I`, with no build-time error, since both
`tsc` and webpack compile/bundle successfully; it only fails when the bundle actually runs in a
browser. This bit essentially every plain-webpack example at once (they'd all copied an `ES5`
`tsconfig.json` from an older template) — if a fresh example's bundle throws this in the browser,
check its `tsconfig.json` target before looking anywhere else.

## Register the example

1. Add the directory name (no `examples/` prefix) as a new line in `examples/examples-list.txt` —
   `etc/publish_new_version.sh` reads this file to bulk-bump every example's dependency versions
   after a release. Skipping this means the example silently keeps pointing at an old version.
2. Add an entry to `examples/index.html` (the StackBlitz gallery page) if the example should be
   publicly browsable; it references the same `sbBranchSuffix` release-branch mechanism used by
   the release script.

## Developing against unpublished engine changes

If the example needs to exercise an in-progress change to core or an adapter (not yet published
to npm), don't bump to a fake version — link locally instead:

```bash
bash etc/switch_example_to_local_gg.sh examples/<your-example-dir>
```

This strips the `@gg-web-engine/*` lines from the example's `package.json`, `npm link`s the local
`packages/*` builds in by path instead, and patches `tsconfig.json` path mappings for libraries
whose types live under a linked package's own `node_modules` (three/pixi/ammo — see the
`fix_*_paths` functions in the script). It's idempotent (safe to re-run) and reversible — undo it
with `bash etc/restore_example_from_local_gg.sh examples/<your-example-dir>`. Run `npm install` at
the repo root first if the local adapter packages themselves need to pick up local core changes;
for the full "edit core, see it live in this example" watch-mode loop (`tsc -b
--watch` + `npm start`), see `gg-engine-core-development`'s local dev workflow section.

## Running

```bash
cd examples/<your-example-dir>
npm install
npm run start   # webpack-dev-server, for plain webpack examples
npm run build   # produces dist/bundle.js for static hosting
```

## Writing the demo itself

Examples are read as documentation — keep `index.ts`/`src/` short, comment the non-obvious parts
(why a controller is attached, what a collision group demonstrates), and prefer the same
bootstrap shape used in the root `README.md` quickstart so readers can map one to the other. See
`gg-engine-app-development` for the API surface to draw on.

Give `world` an explicit type annotation from the visual adapter package (e.g. `const world:
ThreeGgWorld = new Gg3dWorld({...})`, imported from `@gg-web-engine/three`; pixi equivalents follow
the same naming) whenever the demo reaches through `world.visualScene` for adapter-specific members
like `nativeScene`. `Gg3dWorld`'s generic inference from the constructor argument alone does not
carry the concrete visual scene type through — `world.visualScene` infers as the base
`IVisualScene3dComponent` interface, which doesn't declare adapter-specific members, so any access
like `world.visualScene.nativeScene` fails with `TS2339: Property 'nativeScene' does not exist on
type 'IVisualScene3dComponent<...>'` regardless of which physics adapter is paired with it. The
explicit annotation sidesteps the inference entirely and is the pattern already used by examples
like `collision-groups-three-ammo`.

## Keep this skill current

This file is read by future agents adding examples to this repo, not by end users of the engine.
If the registration steps here turn out incomplete (a build/CI/StackBlitz step this file doesn't
mention), or the local-linking workflow needed an extra fix to actually work, add a short note
(what went wrong, why, the fix) before finishing — folded into the relevant section rather than
left as a loose log entry.
