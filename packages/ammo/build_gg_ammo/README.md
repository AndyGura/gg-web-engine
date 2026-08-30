This is a place where I build proprietary ammo.js for gg-web-engine.

The build fetches [AndyGura/ammo.js](https://github.com/AndyGura/ammo.js) (my own fork, itself
originally forked from the now-deleted `i12345/ammo.js`, which was in turn a more up-to-date fork
of the unmaintained upstream [kripken/ammo.js](https://github.com/kripken/ammo.js)) at the pinned
commit in `Makefile`, then applies the patches below on top before compiling. Whichever ammo.js
repo `AMMOJS_GIT_REPO` points at only supplies the JS/TS build tooling (Emscripten/CMake/
webidl2ts wiring) - the actual Bullet source is fetched separately from `BULLET_GIT_REPO` at its
own pinned commit (see `Makefile`), and `ammo.idl` plus the vehicle raycaster source are replaced
wholesale by `patch_files/` regardless of what the fetched repo ships, so this build isn't
sensitive to the fetched ammo.js repo's own Bullet submodule pin or `ammo.idl` version.

Reasons to build own ammo.js instead of using a stock upstream one:
1) The crucial feature, which bullet does not have: use collision groups for raycast vehicle. I
   already made a [PR](https://github.com/bulletphysics/bullet3/pull/4559) to bullet.
1) Expose `m_erp2` property of `btContactSolverInfo`, needed for fighting with object clipping
   problem, which appeared in bullet 2.84. Also made a PR to the (now-deleted) `i12345/ammo.js`
   about it.

(A third reason used to live here: `ammo.d.ts` was missing the `getPointer`/`compare` module
functions, hand-patched into the generated output. That's no longer necessary - the
[PR](https://github.com/anotherpit/webidl2ts/pull/2) fixing it in `webidl2ts` merged, and
`AndyGura/ammo.js`'s `package.json` depends on `github:anotherpit/webidl2ts` unpinned, so a fresh
`npm i` already pulls the fix.)

`patch_files/CMakeLists.txt` and `patch_files/Dockerfile` are a different kind of patch: not a
gg-web-engine feature, but keeping the build itself compiling against a moving Emscripten. The
`Dockerfile` pins `emscripten/emsdk` to an exact tag instead of `:latest`, and `CMakeLists.txt`
merges `EXTRA_EXPORTED_RUNTIME_METHODS` into `EXPORTED_RUNTIME_METHODS` and links the final
`ammo.js`/`ammo.wasm.js` with `em++` instead of `emcc` - both required once this build was re-run
against a current Emscripten (removed `EXTRA_EXPORTED_RUNTIME_METHODS` outright, and `emcc` no
longer defaults to C++ linkage the way it used to, so linking Bullet's C++ objects with plain
`emcc` fails with "undefined symbol: operator new"). If a future emsdk bump breaks the build again,
expect it to show up as one of these two symptoms first.

All changed file diffs in ammo.js and bullet can be found [here](./ammo_patches.txt) and [here](./bullet_patches.txt) appropriately


### How to build
1) Docker has to be installed and started
1) enter this directory and run `make all`
1) commit the resulting changes under `../src/ammo.js` along with any `Makefile`/`*_patches.txt`
   changes

Or trigger the `Rebuild self-built ammo.js` GitHub Actions workflow (`workflow_dispatch`) instead -
it runs the same `make all` in CI and commits the result back to the branch, so this no longer
requires a local Docker install. That workflow also runs automatically (without committing) on any
PR touching this directory, as a check that the build recipe still works - see
`.github/workflows/build_ammo.yml`.
