---
name: gg-engine-examples
description: Add or update a demo project under examples/ in gg-web-engine (webpack demos or the StackBlitz gallery). Use when the task is to create a new example app, not general app development against a published engine version outside this repo.
---

# Adding an example project

`examples/` holds one small, focused demo per feature, under `examples/2d/` and `examples/3d/` —
they double as manual integration tests (rendering adapters have little automated testing, see
`gg-engine-visual-adapter`) and as the tutorials linked from the README and the examples gallery
(`examples/index.html`, deployed to gg-web-demos.guraklgames.com). An example exists once, not once
per renderer/physics combination: it picks its physics adapter at startup (see "Physics backend
selection" below), and the gallery swaps the backend in place by reloading it with a different
query parameter. Nothing is shared between example directories, which is what keeps each one
standalone-cloneable (StackBlitz imports a single directory).

## Pick a template

Copy the nearest existing plain webpack example of the same dimension, e.g. `examples/3d/primitives`
or `examples/2d/primitives`. It contains `index.html`, `index.ts`, `backends.ts` (the physics
backend switch), `webpack.config.js` (prod build), `webpack.dev.config.js` (dev server),
`tsconfig.json`, `package.json`.

Naming convention: `examples/<2d|3d>/<feature-or-topic>` (e.g. `3d/collision-groups-pool`,
`2d/coin-run`) — no library names in the directory, since one directory covers every backend. The
`name` in `package.json` is `<feature-or-topic>-<2d|3d>`.

## Physics backend selection (`backends.ts`)

Every multi-backend example has the same short `backends.ts`: a `PHYSICS_BACKENDS` list, a
`DEFAULT_PHYSICS`, `selectedPhysicsBackend()` reading `?physics=` from `location.search` (falling
back to the default, so the example works opened on its own or in StackBlitz), and
`createPhysicsWorld()` returning `Promise<IPhysicsWorld3dComponent>` (`...2d...` in 2D) through a
`switch` whose branches `await import(/* webpackChunkName: "rapier3d" */ '@gg-web-engine/rapier3d')`
and construct that adapter's world component. The dynamic imports make webpack emit one chunk per
adapter (`ammo.bundle.js`, `rapier3d.bundle.js`, ... via `output.chunkFilename: '[name].bundle.js'`
in `webpack.config.js`), so a page downloads only the engine it runs on - Ammo's glue alone is
2.6 MiB. `index.ts` then has exactly one backend-specific line:

```ts
const world: ThreeGgWorld = new Gg3dWorld({
  visualScene: new ThreeSceneComponent(),
  physicsWorld: await createPhysicsWorld(),
});
```

What that implies for the rest of the example:

- **Top-level `await`** needs `"module": "es2022"` in the example's `tsconfig.json` (TS1378
  otherwise; webpack 5 handles the async entry module on its own). Every multi-backend example sets
  it; a plain `.then()` restructuring is not worth the re-indentation of the whole demo.
- **Type `world` with the visual adapter's alias** (`ThreeGgWorld`, `PixiGgWorld`), not
  `TypedGg3dWorld<ThreeGgWorld, AmmoGgWorld>` - the physics side is unknown at compile time. That
  alias leaves `world.physicsWorld` nullable, so the few places reaching it use `!`
  (`world.physicsWorld!.factory.createRigidBody(...)`). An example that reaches it often wraps the
  alias instead: `Gg3dWorldWithPhysics<ThreeGgWorld>` (`Gg2dWorldWithPhysics<PixiGgWorld>`) types
  `physicsWorld` as core's non-null physics interface (`3d/shooter`, `2d/coin-run`). Everything an
  example may call is on core's physics interfaces anyway (`npm run lint:examples` forbids anything
  else), so no adapter type is ever needed in `index.ts`.
- **Backend-specific tuning goes in `backends.ts`, in that backend's branch**, not in `index.ts`
  behind an `instanceof` (which would need a static import and defeat the splitting).
  `3d/collision-groups-pool` raises Bullet's `maxSubSteps` this way, because only Bullet needs it
  there. A setting that is on core's interfaces and wanted on every backend is set in `index.ts`
  instead - `fixedTimeStep`/`maxSubSteps` are on `IPhysicsWorldComponent` (ignored by adapters that
  don't substep).
- **A world created later than startup** (a game screen's `enter()` in `3d/screens`) awaits
  `createPhysicsWorld()` where it builds the world; no top-level `await` is needed then.
- **A multiplayer example puts the backend in its room link.** Every peer of a room has to simulate
  with the same engine, so `3d/fly-city` and `2d/coin-run` set `physics=` on the URL they build for a room, instead of
  relying on the receiving page's default.
- **The visual side is fixed per dimension** (three.js in 3D, pixi.js in 2D). The gallery still
  sends `visual=three`/`visual=pixi` and shows a (single-option) rendering selector so a visitor
  sees which renderer runs; examples ignore the parameter. A second visual adapter would get the
  same `await import()` treatment in `backends.ts`.
- **Every example runs on every physics adapter of its dimension**, and `examples.json` lists them
  all. The gallery still disables its selector for an entry that lists one backend, but none does.

## package.json

Pin every `@gg-web-engine/*` package to whatever `packages/core/package.json`'s current `version`
is — examples are not meant to float on version ranges. A multi-backend example lists every physics
adapter of its dimension and its visual adapter, and nothing of the libraries underneath:
`three`/`@types/three`, `pixi.js`, `matter-js`/`@types/matter-js` and the rapier compat builds are
dependencies of the adapter that wraps them, pinned there, so an example never pins them a second
time (or in `overrides`) and can't drift from the version the adapter was built against. Ammo needs
no setup either: the WASM glue ships inside `@gg-web-engine/ammo`, whose own `browser` field stubs
the Node built-ins it references, so no `browser` field or `resolve.fallback` belongs in an example.
`npm run lint:examples` rejects all of these. Keep a trailing comma after every `@gg-web-engine/*` line (i.e.
never let one be the last dependency) - the release script's version bump matches `"...": "x.y.z",`
with the comma.

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

Add an entry to `examples/examples.json`, the single registry of examples:

```json
{
  "dir": "3d/my-feature",
  "title": "My feature",
  "description": "One sentence shown under the title in the gallery.",
  "visual": ["three"],
  "physics": ["ammo", "rapier3d"]
}
```

- `dir` is the path under `examples/`; its first segment is the dimension the gallery files it
  under. Entries are listed in the gallery in file order, 3D first then 2D (keep that grouping).
- `physics`/`visual` are the backend ids the example accepts (`ammo`, `rapier3d`, `matter`,
  `rapier2d`; `three`, `pixi`); the first one is the default. A single-backend example lists one.
- `entryFile` (optional, default `index.ts`) is the file StackBlitz opens - `3d/fly-city` points it
  at its Angular component.
- The file's top-level `version` is the git tag the gallery's "Edit in StackBlitz" links open; the
  release script bumps it (`etc/publish_new_version.sh`), never edit it by hand.

Everything else reads this file: the gallery page (`fetch('./examples.json')` at runtime - it is a
static page, no build), `examples/build_examples.sh` and `examples/deploy.sh` (which publishes each
example's `dist/` under its `dir`, next to `index.html` and `examples.json`), and the release
script's per-example dependency bump. An example missing from it is invisible to all of them and
silently keeps pointing at an old engine version after a release.

The gallery's own URL scheme is `?example=3d/primitives&physics=rapier3d&visual=three`; any other
query parameter is forwarded to the example's iframe untouched (so a room link an example produces
keeps working wrapped in the gallery), and the "Open standalone" button opens the example's own
URL - reading the iframe's live URL, which an example may have rewritten (`2d/coin-run` puts its
room id there). Old `#Label__visual__physics` hash links are translated. Preview the page locally
against `dist/` builds with `node examples/serve_gallery.mjs` (a dependency-free static server that
mounts each example's `dist/` at its `dir`, like the CDN); `fetch` of `examples.json` means the page
does not work opened as a `file://` URL.

## Developing against unpublished engine changes

If the example needs to exercise an in-progress change to core or an adapter (not yet published
to npm), don't bump to a fake version — link locally instead:

```bash
bash etc/switch_example_to_local_gg.sh examples/3d/<your-example-dir>
```

This strips the `@gg-web-engine/*` lines from the example's `package.json`, `npm link`s the local
`packages/*` builds in by path instead, and dedupes their peer dependencies (`dedupe_peer_deps` -
see below). It's idempotent (safe to re-run) and reversible — undo it
with `bash etc/restore_example_from_local_gg.sh examples/3d/<your-example-dir>`. Run `npm install` at
the repo root first if the local adapter packages themselves need to pick up local core changes;
for the full "edit core, see it live in this example" watch-mode loop (`tsc -b
--watch` + `npm start`), see `gg-engine-core-development`'s local dev workflow section.

**The script discards unstaged edits to `package.json`** (and `tsconfig.json`,
`webpack.dev.config.js`, `angular.json`): it starts with `git checkout -- package.json ...`, which
restores the *index* version, and links only the `@gg-web-engine/*` packages listed there. `git add`
is enough to protect an edit (it doesn't have to be committed) - but stage *before* running the
script, never after: staging while an example is in its switched state captures the stripped
`package.json`/reset `tsconfig.json` into the index, and the next run of the script then "restores"
exactly that broken state. This bit the 2d/3d restructuring: a build started before `git add`
reset the new `tsconfig.json`, the add then staged the old one, and TS1378 (top-level `await`)
persisted until the file was regenerated. When adding a new
`@gg-web-engine/*` dependency to an example (e.g. an add-on package it did not use before), commit
that `package.json` line first, or link the extra package by hand afterwards with
`npm link <repo>/packages/<each already-linked package> <repo>/packages/<new package>` (a single
`npm link` call replaces the previous links, so list them all) and re-apply the peer-dependency
symlinks, which that call reinstalls as real copies. `restore_example_from_local_gg.sh` resets
`package.json` the same way.

**A brand-new example has no committed `package.json` to go back to.** The script still works on it
(its `git checkout` has nothing to restore), but it strips the `@gg-web-engine/*` lines from the only
copy of `package.json` there is, uncomments a `devServer.static` block in `webpack.dev.config.js`,
and its `npm install` writes a `package-lock.json` without those packages. Before running it on an
example that isn't committed yet, copy `package.json` aside; afterwards put it back, delete the
lockfile, and re-comment (or remove, if the example serves nothing from `../assets`) the
`devServer.static` block. `npm install --package-lock-only` can't produce the real lockfile while
the example uses engine APIs newer than the last published version.

**Do not run a bare `npm install` inside the example directory after this script** (with at least
npm v11) — `npm link <path>` only creates the `node_modules/@gg-web-engine/*` symlinks, it does not
add a `file:`-style entry back into `package.json` or `package-lock.json` (verified: neither file
gains any `@gg-web-engine` line after linking). Since the script already stripped the
`@gg-web-engine/*` lines from `package.json` earlier in the same run, the linked packages are
untracked as far as npm's dependency resolution is concerned, and a subsequent plain `npm install`
prunes them straight back out as extraneous — `node_modules/@gg-web-engine/` ends up empty again
and the next build fails to resolve those imports. The script's own internal `npm install` (which
runs *before* it links) already installs every other dependency, so no further `npm install` is
needed at all — go straight to `npm run build`/`npm start` after the script finishes. If something
did run a bare `npm install` afterwards by mistake, just re-run
`bash etc/switch_example_to_local_gg.sh examples/3d/<your-example-dir>` (idempotent) to relink before
building again.

**Every peer dependency of a linked package must be one physical copy.** A linked package resolves
its peers (`rxjs`, `firebase`) and dependencies (`pixi.js`, `three`, the rapier compat builds) from its
real location - with the root npm workspace hoisting everything, the repo root's `node_modules` -
while the example's own imports resolve its own `node_modules`. Two copies break anything compared by
identity: a pixi `Text`/`Graphics` built by the example holds its copy's `Texture.WHITE`, the
adapter's renderer compares against the other copy's, treats the fill as a texture pattern and throws
`Failed to execute 'createPattern' on 'CanvasRenderingContext2D'` on the first render (three's
classes and rxjs types fail similarly). The script's `dedupe_peer_deps` replaces the example's copy of
each linked package's peer with a symlink to the copy that package resolves, which fixes webpack and
`tsc` at once. A published install never has the problem
(peers dedupe). To confirm one copy in a running dev server: `curl -s localhost:<port>/main.js | grep
-o '"[^"]*node_modules/pixi.js/lib/index.mjs"' | sort -u` prints one path.

The script resets `package.json`/`tsconfig.json`/`webpack.dev.config.js`/`angular.json` with `git
checkout -- $(git ls-files ...)`, i.e. only the ones the example tracks: `git checkout` with any
pathspec that matches nothing restores *none* of the others, so listing `angular.json` for a webpack
example would silently skip the reset and a re-run would read an already-stripped `package.json` and
link nothing. Keep that `git ls-files` filter when adding a file to either script's reset list.

**The script's very first step is `git checkout -- package.json tsconfig.json
webpack.dev.config.js`** (that's what makes re-running it idempotent instead of compounding
patches) — so if you've just hand-edited any of those files (e.g. adding a missing
`@gg-web-engine/*` dependency line before it's been committed) and then run this script, your edit
is silently discarded before the script even reads the file, and the `@gg-web-engine/` lines it
greps for `libs=(...)`/`npm link`s come from the **committed** version, not your working tree.
Symptom: the script exits 0 with no error, but `node_modules/@gg-web-engine/` ends up empty and
nothing got linked — easy to misread as the script being broken. Either commit the fix first, or
skip the script and run its `npm link $(cd ../../packages/<lib> && pwd) ...` step by hand against
your uncommitted file. This also means: **never commit an example while it's in its "switched"
(locally-linked) state** — a commit made after running this script captures `package.json` with
its `@gg-web-engine/*` lines already stripped (and, for an Ammo-backed example, `tsconfig.json`'s
`paths` already rewritten to point into a linked package's own `node_modules`, and, for an example
with a shared `examples/assets` dependency, `webpack.dev.config.js`'s `devServer.static` block
uncommented — see "Adding a shared asset under `examples/assets`" below), so every future `git
checkout`/clone of that commit starts from a broken, non-standalone package.json — run
`restore_example_from_local_gg.sh` (or `git checkout` the three files back) before committing.

## Running

```bash
cd examples/3d/<your-example-dir>
npm install
npm run start   # webpack-dev-server, for plain webpack examples
npm run build   # produces dist/ (bundle.js + one chunk per physics adapter) for static hosting
```

`3d/fly-city`'s Angular CLI refuses to start on Node older than 22.22.3 (or 24.15); an older system
Node needs a newer one first (`nvm install 24`). Regenerate an example's `package-lock.json` with
npm 11 too (`npm install --package-lock-only`): npm 10 drops the lockfile's `libc` fields, which
shows up as a large unrelated diff.

Append `?physics=<backend>` to the dev server's URL to run on another backend than the default. To
see the result inside the gallery, `npm run build` and `node examples/serve_gallery.mjs` from the
repo root.

## Adding a shared asset under `examples/assets`

The shared `examples/assets` folder is published as a whole to the hosted demo CDN by
`examples/deploy.sh` (`aws s3 sync ./assets s3://gg-web-engine-demos/assets`), so an asset placed at
`examples/assets/<subfolder>/<name>.glb` ends up reachable at
`https://gg-web-demos.guraklgames.com/assets/<subfolder>/<name>` once deployed - which is why
existing GLB-loading examples (e.g. `3d/glb-loader`) hardcode that absolute CDN URL directly
in their committed `index.ts` rather than a relative path. That URL obviously doesn't exist yet for
an asset added in the same change as the example using it, and this repo has no established way to
test against it locally before an actual deploy. For an example that needs its new asset to actually
load during local `npm start` (so it can be verified in-browser, not just compile-checked), add a
`devServer.static` entry to that example's `webpack.dev.config.js` serving the shared folder at the
same `/assets` path structure the CDN uses:

```js
devServer: {
  static: [{ directory: path.resolve(__dirname, '../../assets'), publicPath: '/assets' }],
},
```

then reference the asset from `index.ts` as `/assets/<subfolder>/<name>` (no extension, for a loader
that appends one itself, e.g. `loadFromGlb`/`loadGgGlb`-style path conventions). This only serves
`examples/assets` for that one example's own dev server - it has no effect on `npm run build`'s
`dist/bundle.js`, which stays a plain bundle same as any other example (the CDN copy comes from
`examples/deploy.sh`'s own `assets` sync, not from anything in an example's `dist/`).

Commit this `devServer.static` block **commented out**, exactly as shown above (the script matches
the lines verbatim, `'../../assets'` included - examples sit two levels below `examples/`) - a
standalone clone of just that one example directory (e.g. via StackBlitz/degit) has no `../../assets`
folder to serve, so an active block would break `npm start` there. `switch_example_to_local_gg.sh`
uncomments it automatically (it's running inside the full repo checkout, where `../../assets` does
exist) via its
`fix_dev_server_assets` function, and `restore_example_from_local_gg.sh` reverts it back to
commented-out via its `git checkout -- ... webpack.dev.config.js` - so day-to-day local development
never needs you to touch this block by hand, only the initial commit adding it.

**Angular examples** (`examples/3d/fly-city`) have no webpack config, and Angular's
`assets` build option refuses folders outside the workspace root (`../../assets` is rejected). Instead
the example commits a `proxy.conf.mjs` that starts a tiny static file server over `../../assets` and
proxies `/assets` to it; `switch_example_to_local_gg.sh` enables it by adding
`"options": { "proxyConfig": "proxy.conf.mjs" }` to the dev-server in `angular.json` (also in
`fix_dev_server_assets`), and both scripts `git checkout` `angular.json` to undo it. Never commit
`angular.json` with `proxyConfig` set, for the same standalone-clone reason. Reference the asset
as `/assets/<subfolder>/<name>` from code.

### An asset that belongs to just one example (not shared/CDN-deployed): bundle it via webpack directly

Not every example asset needs the `examples/assets` CDN treatment above - a texture/atlas/image
that's only ever used by one specific example (e.g. a hand-authored sprite sheet for a single demo)
belongs inside that example's own directory instead (e.g.
`examples/<your-example>/assets/character-atlas.png`), committed alongside whatever script generated
it (see the procedural-generation pattern below - the same "keep the generator script next to its
output" reasoning applies to a 2D image just as much as a 3D `.glb`). Load it as an ordinary bundled
webpack asset rather than reaching for the CDN/`devServer.static` machinery above:

1. Add an `asset/resource` rule to *both* `webpack.config.js` and `webpack.dev.config.js`'s `module.rules`:
   ```js
   { test: /\.png$/, type: 'asset/resource' },
   ```
2. Add an ambient module declaration (e.g. `assets.d.ts` at the example's root) so `tsc`/`ts-loader`
   accepts the import at all - webpack's own asset-module resolution isn't something the TypeScript
   compiler knows about on its own:
   ```ts
   declare module '*.png' {
     const src: string;
     export default src;
   }
   ```
3. `import atlasUrl from './assets/character-atlas.png';` in `index.ts` - webpack resolves this to a
   content-hashed URL string at build time (e.g. `1cb559558c4f56d7df06.png`), and both `npm start`
   and `npm run build` serve/emit it correctly with no further config. Hand that URL to the
   engine's texture loader (`world.visualScene.factory.loadTexture(atlasUrl, { filter: 'nearest' })`
   in 2D, `world.visualScene.loader.loadTexture(url)` in 3D) exactly as if it were served from a
   real path.

This is a different mechanism from the shared-CDN-asset workflow above on purpose: a CDN-synced
asset must stay a stable, absolute, hand-typed URL (deploy-time, not build-time), while an
example-owned asset should just be a normal bundled module - don't set up `devServer.static`/hardcode
a CDN URL for something only one example will ever reference.

### Generating a placeholder 3D asset procedurally instead of sourcing one

When an example needs a `.glb` this repo has no license-clean way to source externally (e.g. a
rigged, animated character model, where a "just download one" instinct runs into real licensing
questions), building it programmatically with three.js in a throwaway Node script - then baking it
to `.glb` via `GLTFExporter` - is a viable, self-contained alternative. `examples/assets/characters/
generate-blockman.mjs` is a worked example (a boxy humanoid `SkinnedMesh`, hand-built bone hierarchy,
keyframed `AnimationClip`s) - keep a generator script like this committed alongside its output
`.glb`, the same role a `.blend` source file plays for the hand-authored assets elsewhere under
`examples/assets`, so the binary isn't the only record of how it was made and it can be regenerated/
tweaked later. Run such a script as plain Node from somewhere inside the repo tree (not `/tmp` or
another scratch location) so `three`'s own subpath exports (`three/examples/jsm/...`) resolve
against the repo's hoisted root `node_modules` via ordinary upward node_modules resolution - Node's
ESM resolver doesn't honor `NODE_PATH`, so a script located outside the repo entirely won't find it
without its own separate `npm install`.

**`GLTFExporter.parse()`/`parseAsync()` needs a `FileReader` polyfill to run under plain Node,
regardless of the `binary` option.** It unconditionally builds its output through `new
Blob(buffers, ...)` then `new FileReader().readAsArrayBuffer(blob)` (binary `.glb`) or
`.readAsDataURL(blob)` (embedded-base64 JSON) internally - `Blob` is a Node global since v18 and
works fine, but `FileReader` is browser-only and doesn't exist in Node at all, so export throws
`FileReader is not defined` with no polyfill, on every export regardless of `options.binary`. Fix:
assign a minimal `globalThis.FileReader` before calling the exporter, backed by the real Node
`Blob`'s own `.arrayBuffer()`:

```js
class NodeFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buf => { this.result = buf; this.onloadend?.(); });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then(buf => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buf).toString('base64')}`;
      this.onloadend?.();
    });
  }
}
globalThis.FileReader = NodeFileReader;
```

This is the only Node-incompatibility that matters for a script with no image/texture content (pure
geometry, skinning, vertex colors, animation) - the exporter's other browser-only paths
(`document.createElement('canvas')`, `OffscreenCanvas`, `ImageBitmap`) are only reached while
processing texture images, never for geometry-only export.

**Author the whole rig directly with height along three.js's own Z axis, not its natively Y-up
convention**, per this engine's own Z-up-always 3D convention (see this repo's root `CLAUDE.md`) -
GLTFExporter is a straight numeric passthrough (three.js's coordinate space already matches the
glTF spec's Y-up convention 1:1, so it does no axis conversion of its own), and the engine's own GLB
loading path (`ThreeLoader.loadFromGgGlb`/`loadFromGlb`) applies no corrective rotation either
(unlike `three-factory.ts`'s primitive-shape generators, which do rotate three's Y-up-native
`CapsuleGeometry`/etc. onto Z - see `gg-engine-core-development`'s "Non-obvious repo facts"). A
script authoring content with the natural three.js Y-up convention and exporting verbatim would load
into the engine lying on its side. This is the same "don't do the usual up-axis conversion" outcome
the engine's own Blender exporter reaches via `export_yup=False`
(`blender-addon/gg_web_engine_exporter/exporter.py`) - just reached here by authoring directly in
that target convention from the start instead of converting an existing Z-up Blender scene at
export time.

### Generating a placeholder 2D pixel-art sprite atlas procedurally instead of sourcing one

The same licensing-clean-placeholder reasoning applies to a 2D character sprite sheet (idle/walk/
run/jump-style atlas) - draw it with a throwaway Python/Pillow script instead of sourcing external
art, and keep the script committed next to its output PNG (e.g.
`examples/<your-example>/assets/generate-character-atlas.py` alongside `character-atlas.png`), same
as a 3D asset's own generator. Much simpler than the GLB pipeline above (no `FileReader` polyfill,
no rig/skinning): draw each frame on a small logical-pixel canvas (e.g. 16x24) with plain rectangle
fills for body parts, upscale with `Image.resize((w, h), Image.NEAREST)` (never a smooth resampling
filter, which would defeat the deliberately blocky pixel-art look), and composite the frames into one
atlas image (`Image.new("RGBA", ...)` + repeated `.paste(frame, (col * frameW, row * frameH), frame)`
using the frame itself as its own alpha mask). A parametric per-frame "pose" (leg/arm x-offset +
"lift" height, whole-body vertical bob, computed from a `sin`/triangle-wave phase per frame index) is
enough to fake a readable walk/run stride and a jump arc (crouch → launch → rise → apex → fall →
land) without hand-placing every pixel of every frame individually. If the system Python's `pip` is
externally managed (`pip install` refuses with `externally-managed-environment`), create a throwaway
venv in the scratchpad directory (`python3 -m venv <scratchpad>/venv && <scratchpad>/venv/bin/pip
install Pillow`) rather than passing `--break-system-packages` against the system interpreter.
Sanity-check the result by cropping/upscaling individual rows or frames back out and reading them as
images before wiring the atlas into the example - a raw thumbnail of the whole grid at native
resolution is often too small to tell a genuine rendering bug (e.g. a mis-sliced frame rectangle)
apart from the art simply being small.

## Live-debugging an example through browser automation

When chasing a reported gameplay bug (movement/physics behaving wrong, not a build error), driving
the actual running example through Chrome automation and inspecting live state beats guessing from
source alone - but a background automation tab throttles `requestAnimationFrame` down to near zero
FPS (confirmed empirically: a tab left running for real wall-clock seconds while backgrounded can
report `0 FPS` and never fire a single real tick), which breaks two things at once if not worked
around:

- Any `await new Promise(r => setTimeout(...))`-based wait for "let a few real frames pass" in an
  injected script can hang until the tool call itself times out, since the frames it's waiting on
  never actually fire.
- If the world *was* left running via its normal `requestAnimationFrame`-driven loop for a while
  before you intervene, the first real tick that eventually does fire can report a huge one-frame
  `delta` (real elapsed wall-clock time, not a sane ~16ms) - enough to send a physics-driven entity
  flying or falling through geometry entirely in that single tick, which looks exactly like a real
  physics bug but is purely a test-harness artifact.

Sidestep both by never depending on real `requestAnimationFrame` ticks for the scripted part of a
session at all: add `world.worldClock.pause();` on the very next line after `world.start();` in the
example's `index.ts` (temporarily - revert before finishing), so the world is already paused by the
time the page has rendered its first frame, and drive it entirely with manual, fixed-size steps
instead - `world.worldClock.step(16)` in a loop - from an injected script. This gives fully
deterministic, real-code-path ticks (the actual entity/component logic, not a re-implementation of
it) with no dependency on wall-clock timing or tab visibility at all. Expose whatever
entities/world reference the injected script needs via a temporary `(window as any).__gg = {
world, ... };` line, and remove both temporary lines before finishing - see `git diff` on the
example's `index.ts` to confirm nothing but the intended fix remains.

Driving *two* example tabs at once (e.g. a multiplayer room) adds one more trap: a hidden tab clamps
`setTimeout` to at least one second, so a step loop that yields with `await new Promise(r =>
setTimeout(r, 0))` crawls at one tick per second (and a `wait until joined` poll with a short
timeout outlives the tool call). Yield through a `MessageChannel` instead (`port2.postMessage` /
`port1.onmessage` tasks aren't throttled) - network messages (WebRTC data channels,
`BroadcastChannel`) still get processed between steps. Start one tab's loop fire-and-forget (with a
`window.__stop` flag to end it), then drive the other tab's scenario in its own call.

A script injected through the automation tool is cut off after 45 seconds, though it keeps running
in the page. Anything longer (many load/unload round trips, say) is started fire-and-forget, writes
its result to a `window` property when done, and is polled from later calls. Looking at the page
while such a script is still running shows it mid-transition, which is easy to misread as a bug.

**Real keyboard events do not reach a backgrounded automation tab at all** - confirmed empirically:
dispatching a key press through the browser tool's OS-level key-press action produced *zero*
`keydown` events even on a raw `window.addEventListener('keydown', ..., true)` listener added purely
to check, for multiple different keys, while the same tab's mouse clicks did register. This isn't
specific to this engine's `KeyboardInput` - no JS in the page saw the event at all. So a bug reported
as "a key doesn't do anything" cannot be confirmed *or* ruled out this way; don't spend time
concluding "reproduced" or "not reproduced" for a keyboard-only symptom from a real dispatched key
press in this environment. What *does* work for exercising keyboard-driven behavior under automation
is calling the input primitive's own emulate/test hooks directly from an injected script (e.g.
`world.keyboardInput.emulateKeyDown('Space')`/`emulateKeyUp(...)`, mirroring what the engine's own
integration tests do) - this proves the app logic downstream of a key press is correct, but tells you
nothing about whether the real DOM event actually reaches that code in an actual browser (focus
state, `preventDefault`/blacklisted-focused-element filtering, etc.) - treat a bug that only
reproduces for a real user, not through either the emulate-hook path or a direct call into the
gameplay API, as a real-browser-event-plumbing issue to reason through from source rather than one
you can confirm live from this tool.

## Writing the demo itself

Examples are read as documentation — keep `index.ts`/`src/` short, comment the non-obvious parts
(why a controller is attached, what a collision group demonstrates), and prefer the same
bootstrap shape used in the root `README.md` quickstart so readers can map one to the other. See
`gg-engine-app-development` for the API surface to draw on.

**Examples use `@gg-web-engine/*` APIs only.** No direct import of `three`, `pixi.js`, `ammo.js`,
`matter-js` or `@dimforge/*`, and no adapter `native*` escape hatch (`nativeMesh`, `nativeSprite`,
`nativeBody`, ...): an example is a tutorial, and one that reaches into the native library teaches a
renderer-locked pattern and hides a gap in the engine. `npm run lint:examples` at the repo root
(`etc/check_examples_no_native.mjs`, also run by the PR workflow) fails on any such line. It also
fails on an integration library (or `mini-signals`) in an example's `package.json` or `overrides`, a
`browser` field or `fs`/`os`/`path: false` stub in a build config, and an `examples.json` entry that
doesn't list every physics adapter of its dimension. When a demo
needs something core can't express yet, add the option to core and every relevant adapter (see
`gg-engine-core-development` and the adapter skills) and use it from the example. A line that
deliberately demonstrates native interop can opt out with a trailing `// gg-allow-native` comment.
Adapter-package exports that aren't native objects (`ThreeSceneComponent`, `PixiCameraComponent`,
`ThreeDisplayObject3dOpts`, world type aliases) are fine.

**An example that opens straight into a level shows the engine's loading screen.** `const
loading = LoadingScreen.show();` goes right before the world is constructed (so it also covers the
dynamic import of the physics backend), `loadLevel` gets `{ onProgress: p => loading.setProgress(p)
}`, and `loading.hide()` follows `world.start()`. An example that starts on its own menu
(`3d/screens`) leaves it out; its `ScreenManager` shows the same view while a screen enters.

**`GgStatic` in an example is a debugging aid for the demo, nothing more.** Examples turn on
`GgStatic.instance.devConsoleEnabled` (and often `showStats`) so a reader can poke at the running
scene. Nothing the demo shows may depend on it: no gameplay, UI or loading step goes through
`GgStatic` or a console command, and the demo has to work the same with those lines deleted. A real
app keeps them out of its production build (see `gg-engine-app-development`).

Give `world` an explicit type annotation from the visual adapter package (e.g. `const world:
ThreeGgWorld = new Gg3dWorld({...})`, imported from `@gg-web-engine/three`; pixi equivalents follow
the same naming) whenever the demo reaches through `world.visualScene` for adapter-specific members
like `nativeScene`. `Gg3dWorld`'s generic inference from the constructor argument alone does not
carry the concrete visual scene type through — `world.visualScene` infers as the base
`IVisualScene3dComponent` interface, which doesn't declare adapter-specific members, so any access
like `world.visualScene.nativeScene` fails with `TS2339: Property 'nativeScene' does not exist on
type 'IVisualScene3dComponent<...>'` regardless of which physics adapter is paired with it. The
explicit annotation sidesteps the inference entirely and is the pattern already used by examples
like `3d/collision-groups`.

## TypeScript 6 pitfalls in examples specifically (hit upgrading every example off TS 5.x)

Examples don't `extend` the root `tsconfig.base.json` (they're standalone/StackBlitz-clonable), so
they don't inherit any of that file's TS6 fixes — each example's own `tsconfig.json` needs these
independently:

- `"ignoreDeprecations": "6.0"` — TypeScript 6 hard-errors (`TS5107`) on `"moduleResolution": "node"`
  (every example uses this), not just warns. Same escape hatch `tsconfig.base.json` already uses.
  Switching to `"moduleResolution": "bundler"` is not a safe alternative for an ammo-based example:
  it breaks resolving `@gg-web-engine/ammo`'s extensionless `./ammo.js/ammo` relative import in its
  shipped `.d.ts`.
- **TypeScript 6 defaults the whole `strict` family (`strictNullChecks`, `noImplicitAny`,
  `strictFunctionTypes`, ...) to `true` when a tsconfig doesn't set `"strict"` or the individual
  flags at all** — a genuine default-value change, not new-syntax deprecation, and easy to
  mis-diagnose since nothing else changed. Verified directly: identical code type-checks clean
  under TS 5.5.4 with a bare tsconfig and fails under TS 6.0.3 with the same bare tsconfig; adding
  `"strict": false` explicitly restores the old behavior. No example's tsconfig opted into strict
  mode before, so this silently turns on `TS18047` ("possibly null") on every access to a nullable
  core member (`Entity3d.object3D`/`.objectBody`, `Gg3dWorld.physicsWorld`, etc.) and can trip
  `strictFunctionTypes` on a callback explicitly annotated with a bare class type (e.g.
  `(entity: Entity3d) => ...`) instead of a properly-parametrized one (`Entity3d<ThreeTypeDoc>`) or
  left to infer. Fix each real site with a `!` non-null assertion (matching the idiom already used
  in adapter source, e.g. `nativeScene!`) or a proper type annotation — don't paper over it with
  `"strict": false"`.
- `"skipLibCheck": true` if the example depends on a rapier adapter — `@dimforge/rapier*-compat`'s
  declarations use `Symbol.dispose` (`TS2550` below an `esnext` lib), and `@types/three` has errors
  of its own under `"moduleResolution": "node"`. `skipLibCheck` is the app-side stopgap for a
  third-party declaration file you don't own. A webpack build can pass without it while `npx tsc
  --noEmit -p .` fails, so check with the latter.

## Dependency-version-skew pitfalls when examples and `packages/*` are upgraded in the same pass

Examples install `@gg-web-engine/*` from the **published npm registry**, not from local
`packages/*` sources (unless linked via `switch_example_to_local_gg.sh`). If `packages/*`'s own
`package.json` dependency versions are bumped locally but not yet republished (mid-upgrade, before
a release), the *published* `@gg-web-engine/*` tarball's `peerDependencies`/`dependencies` still
point at the old versions, which causes two distinct problems in any example that also bumps the
same shared library:

- **`npm install` fails with `ERESOLVE`** the moment the example pins a peer'd library (e.g. `three`,
  `rxjs`, a rapier compat package) to a version the published adapter's
  `peerDependencies` doesn't allow. Fix: `npm install --legacy-peer-deps`. This is a temporary,
  repo-wide condition that resolves itself once the packages are actually republished at a version
  whose metadata matches — not something to "fix" by pinning the example back to an old version.
  `--legacy-peer-deps` also stops npm auto-installing peers, and prunes any peer-only package
  already in the lockfile, so a library an adapter version still declared as a peer (adapters up to
  0.0.78 did for `three`, `pixi.js`, `matter-js` and the rapier compat builds) is then missing:
  `Module not found: Can't resolve 'matter-js'`. Adapters now carry those libraries as
  `dependencies`, which `--legacy-peer-deps` still installs.
- **A second, nested physical copy of the shared library gets installed even with
  `--legacy-peer-deps`**, if the published adapter package declares it as a real (non-peer)
  `dependency` with an exact version — `@gg-web-engine/core@0.0.59` does this for `rxjs` (pinned
  exactly at `7.8.1`). npm can't dedupe an exact-pin mismatch, so it nests a second `rxjs` copy
  under `node_modules/@gg-web-engine/core/node_modules/rxjs`. Because classes like `rxjs`'s
  `Subject`/`Subscription` have private fields, TypeScript treats the two copies as **nominally
  incompatible types** — this cascades into large numbers of misleading, seemingly-unrelated errors
  (e.g. `TypedGg3dWorld<...>` silently collapsing to `never`, producing `TS2339: Property 'X' does
  not exist on type 'never'` everywhere `world` is used, with no error at the `world` declaration
  itself). Diagnose by checking for more than one installed copy
  (`find node_modules -maxdepth 4 -name rxjs -type d`). Fix: add an `"overrides"` block to the
  example's own `package.json` pinning the shared library to one version (e.g.
  `"overrides": { "rxjs": "7.8.2" }`), which forces npm to collapse the whole tree onto a single
  copy. This becomes redundant (but harmless) once the adapter packages are actually republished
  with matching versions.

## `ng update` gotcha for Angular examples

`ng update`'s failure-rollback discards **all** uncommitted progress since the last git commit, not
just the failed step — if you're stepping through several major versions in sequence (e.g. 19 → 20
→ 21 → 22, generally safer than jumping straight to the latest major), commit (or otherwise
snapshot) after each successful step, or a later step's failure silently wipes everything already
done. This bit a real upgrade: an unrelated transient `npm` install error on one step reverted two
already-successful prior major-version bumps back to the original pre-upgrade state.

Stepping through every major from a much older baseline (e.g. Angular 14 → 22) also needs the
`use-application-builder` migration partway through (`ng update @angular/cli --name
use-application-builder`) once the target is Angular 17+, since the old webpack-based
`@angular-devkit/build-angular:browser` builder doesn't exist past a certain major; run it right
after the step that lands the last major it still supports, then keep stepping. Switching to the
new esbuild `@angular/build:application` builder can turn a previously-cosmetic
`anyComponentStyle` budget warning (e.g. inlined Google Fonts CSS) into a hard build-failing error
under the same `angular.json` budget numbers, because the new builder measures inlined font CSS
under that budget type too (reported as `css-inline-fonts:...`), where the old builder didn't. Just
raise the budget to fit the actual current size — it's a real, static asset, not something to
shrink.

Also double check `@types/three` (or any other `@types/*` for a peer'd runtime library) actually
matches the real library version pinned in the same `package.json` — a stale `@types/three` behind
an already-bumped `three` is a common way for one example to get missed in an otherwise
repo-wide dependency pass, and it fails as a confusing `TS2307: Cannot find module 'three/webgpu'`
deep inside `@types/three/examples/jsm/loaders/KTX2Loader.d.ts` rather than an obvious
version-mismatch error.

## Keep this skill current

This file is read by future agents adding examples to this repo, not by end users of the engine.
If the registration steps here turn out incomplete (a build/CI/StackBlitz step this file doesn't
mention), or the local-linking workflow needed an extra fix to actually work, add a short note
(what went wrong, why, the fix) before finishing — folded into the relevant section rather than
left as a loose log entry.
