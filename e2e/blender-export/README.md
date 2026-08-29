# Blender export end-to-end test

Builds a fixture scene in Blender covering every object kind the `GG Web Engine Exporter` add-on
(`blender-addon/`) understands, exports it, then loads the result back through a real
`Gg3dWorld` - `@gg-web-engine/three` for rendering, `@gg-web-engine/rapier3d` for physics - and
asserts against the three.js scene graph, the `.meta` sidecar, and the constructed physics bodies.

This lives outside `packages/` and `blender-addon/` on purpose: it isn't a package anyone installs,
it's a test harness that happens to need both a Blender install and a full `@gg-web-engine/*` app,
neither of which the packages it's testing should depend on.

## Layout

```
fixture/build_scene.py   Blender script: builds the fixture scene from scratch and exports it
                          (no binary .blend fixture is committed - see the script's own docstring
                          for exactly what it builds and why)
app/                      A small standalone app - the "real app" half of the test - with its own
                          package.json (devDependencies on @gg-web-engine/core, three, rapier3d)
app/test/*.e2e.spec.ts    The actual assertions, run with Jest
```

## Running locally

Requires a `blender` binary on PATH (any recent Blender works - the fixture doesn't touch
version-specific features) and the repo's npm workspace installed at the root (`npm install` in the
repo root - this is what links `app/`'s `@gg-web-engine/*` devDependencies to the local
`packages/*` sources rather than a published npm version; see `gg-engine-core-development`).

```bash
cd e2e/blender-export
npm run export-fixture   # runs Blender headless, writes fixture/dist/scene.{glb,meta}
npm test                 # runs app/'s Jest suite against that fixture
```

Re-run `export-fixture` any time `fixture/build_scene.py` or the add-on's `exporter.py` changes;
`fixture/dist/` is gitignored build output, not something to commit.

## What's actually being tested, and how

- **The exporter** (`blender-addon/gg_web_engine_exporter/exporter.py`, invoked here the same way
  `blender-addon/scripts/export_cli.py` invokes it for real CI/pipeline use) - does it produce a
  `.glb`/`.meta` pair with the shapes/content `build_scene.py` put into the scene.
- **The loader** (`Gg3dLoader.loadGgGlb`, `packages/core/src/3d/loader.ts`) - does it correctly
  fetch, combine, and hand off that pair to the visual and physics adapters.
- **The three.js adapter** (`@gg-web-engine/three`'s `ThreeLoader`) - does the mesh/light end up as
  real `THREE.Object3D`s in `world.visualScene.nativeScene` once `world.addEntity(...)` is called.
- **The rapier3d adapter** (`@gg-web-engine/rapier3d`) - does each top-level `.meta` rigid body
  (including a `COMPOUND` with two nested `BOX` children, exercising the recursive case) turn into a
  real physics body with the right shape.

`app/test/export-load.e2e.spec.ts`'s own header comment has the full list of what's covered and
what's deliberately left out (other collision shapes, textures). If you add a new object kind or
shape to the exporter, extend `build_scene.py` and the spec together - one without the other tests
nothing new.

### Environment quirks fought here so you don't have to

Consuming a real `@gg-web-engine/*` app under Jest turned up a few environment gaps worth knowing
about if this ever needs touching again (see `app/test/jest.setup.ts` and `app/package.json`'s
`jest.moduleNameMapper`):

- `@gg-web-engine/*` packages compile to ESM (`module: "es6"` in the shared `tsconfig.base.json`)
  without `"type": "module"`, which plain Node/Jest can't `require()` directly - real apps consume
  them through a bundler (webpack, as every `examples/*` app does), which this test harness doesn't
  have. `app/package.json`'s `jest.moduleNameMapper` points `@gg-web-engine/{core,three,rapier3d}`
  straight at each package's `src/index.ts` instead of `dist/`, exactly like `packages/rapier3d` and
  `packages/ammo`'s own unit tests already do - ts-jest compiles them to CommonJS on the fly.
- `@gg-web-engine/core` touches `window`/`HTMLInputElement` etc. at import time, so this needs
  `testEnvironment: "jsdom"`, not plain `"node"`.
- jsdom's environment doesn't provide `fetch` (which `Gg3dLoader` uses to load the fixture) or
  `TextDecoder`/`TextEncoder` (which `GLTFLoader` uses to read the glTF JSON chunk out of the
  binary `.glb`) - `jest.setup.ts` polyfills both. The `fetch` polyfill is intentionally minimal -
  only the two `Response` methods the loader actually calls (`arrayBuffer()`/`text()`) - not a
  general-purpose fetch shim.
- That `fetch` polyfill has to copy bytes into a `new Uint8Array(...)` created in the test's own
  realm before returning them as an `ArrayBuffer`. Node's `Buffer` is backed by an `ArrayBuffer`
  from Node's realm, which fails `instanceof ArrayBuffer` checks made by code running inside
  jsdom's realm (e.g. `GLTFLoader`'s binary-vs-JSON sniff) even though `Object.prototype.toString`
  reports it identically - a classic dual-realm gotcha, not a `GLTFLoader` bug.

## CI

Runs in `.github/workflows/blender_export_e2e.yml`, gated on paths under `blender-addon/`, `e2e/`,
and the loader/adapter source (`packages/core/src/3d/**`, `packages/three/**`,
`packages/rapier3d/**`) - not on every PR, since it needs to install Blender headless (a few hundred
MB), unlike `pull_request_build.yml`.
