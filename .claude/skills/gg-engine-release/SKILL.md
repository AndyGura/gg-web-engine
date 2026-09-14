---
name: gg-engine-release
description: Cut a new gg-web-engine release — version bump commit convention, the publish pipeline across all packages, and post-release manual follow-ups. Use when the task is to release/publish a new version of the engine's npm packages, not ordinary feature development.
---

# Releasing gg-web-engine

All `@gg-web-engine/*` packages are released **together, at the same version number**, driven by a
single commit convention plus one orchestration script. There is no per-package independent
versioning.

## Trigger

A push to `main` whose latest commit message matches `^\[pre-release\] \[X\.Y\.Z\]` runs
`.github/workflows/release_action.yml`. Any other commit message on `main` makes the job exit early
(`PRE_RELEASE=false`) — it's a no-op, not a failure. So "cutting a release" in practice means
landing a commit on `main` with that exact message prefix and the target version.

## What the pipeline does (`etc/publish_new_version.sh X.Y.Z`)

1. Bumps `packages/core/package.json` version, clean-installs, `prettier-format`, builds, and
   `npm publish`es core first.
2. Polls `npm view @gg-web-engine/core version` until the just-published version is live (up to 5
   minutes) before touching dependents.
3. In parallel, for every package in its `libs` array (`three`, `ammo`, `rapier2d`, `rapier3d`,
   `pixi`, `matter`): bumps its own version **and** its `@gg-web-engine/core` dependency version,
   clean-installs, formats, builds. Every `npm i` in this script passes `--workspaces=false` — even
   though `packages/*` is an npm workspace for local dev (see `gg-engine-core-development`), the
   release build must install the just-published real `@gg-web-engine/core` from the registry as a
   sanity check, not silently resolve it back to the local workspace symlink, and the parallel
   per-package installs would otherwise race on one shared root lockfile.
4. Publishes each of those packages to npm, then polls npm again until every one is live.
5. Bumps `@gg-web-engine/*` dependency versions in every example listed in
   `examples/examples-list.txt` and reinstalls them, in parallel.
6. Rewrites the StackBlitz branch suffix (`sbBranchSuffix`) in `examples/index.html` to the new
   version.

After the script, the workflow also regenerates API docs (`documentation/` via `npm run
generate`), commits the version bump back to `main`, tags the release, and deploys
`documentation/site` to GitHub Pages.

## Known failure modes when a package is new to the release

A package's first-ever appearance in a release (freshly added to `libs`, e.g. `audio`) hits two
npm-registry quirks that already-released packages never trigger, both already fixed in
`etc/publish_new_version.sh` — noted here so a future "new package" addition doesn't reintroduce
either:

- **Private-by-default on first publish.** A brand-new scoped package's first `npm publish`
  defaults to restricted/private access unless told otherwise — npm only remembers "public" once a
  first publish has established it. `core` passes `npm publish --access public` explicitly; the
  per-package publish loop for `libs` now does too, for the same reason. Without it, a new
  package's first release fails with `402 Payment Required - You must sign up for private
  packages`, while every already-released package keeps working with a bare `npm publish` (their
  public access was established long ago).
- **`npm view` 404s instead of returning a stale version.** `wait_package_publish` polls
  `npm view "$package_name" version` until it equals the just-published version. For an
  already-released package, before the new version propagates `npm view` still succeeds and just
  returns the old version, so the loop's not-equal check prints and retries normally. For a
  package's first-ever publish, npm hasn't indexed it at all yet, so `npm view` exits non-zero
  (`404 Not Found`) instead. The script has `set -e`, and that failing command sits in a plain
  `var=$(...)` assignment, so the *whole script* dies immediately on that 404 — no retry, no
  timeout message, just an abrupt failure right after the npm error. Fixed by swallowing the
  failure (`npm view ... 2>/dev/null || echo ""`) so a 404 is treated as just another "not yet
  available" tick and the loop keeps polling until the package is indexed or the 15-minute timeout
  hits.

If a release fails partway (some packages published at `X.Y.Z`, one failed before publishing),
don't retry the same version — `npm publish` rejects re-publishing a version that already exists
for a package. Cut the next attempt as `[pre-release] [X.Y.(Z+1)]` instead; the packages that did
succeed at the old version are harmless leftovers on npm.

## Adding a new package to the release

A new adapter package (see `gg-engine-visual-adapter` / `gg-engine-physics-adapter`) is **silently
excluded** from releases until you add it to:

- the `libs` array in `etc/publish_new_version.sh`
- the per-package build/test step list in `.github/workflows/pull_request_build.yml`
- the root `tsconfig.json`'s `references` array (so `npm run build:watch` picks it up locally —
  not required for releases themselves, but easy to forget at the same time)

It does **not** need registering anywhere for local dev linking: `packages/*` is an npm workspace,
so a new package directory is picked up by the next `npm install` automatically (see
`gg-engine-core-development`).

## Manual follow-ups (the script prints these — don't skip them)

1. Double-check the code sample in the root `README.md` quickstart still matches the current API.
2. Redeploy any separately-hosted example demos.
3. Spot-check the StackBlitz links for all examples still open correctly at the new branch suffix.

## Things not to do

- Don't hand-edit `packages/core/src/version.ts` — it's generated by core's own `build` script
  (`update-version`) from `package.json`, and the release script bumps `package.json`, not this
  file, directly.
- Don't publish an adapter package independently of core, or at a different version number — every
  adapter's `peerDependencies`/`devDependencies` pin an exact `@gg-web-engine/core` version, and
  apps are expected to install matching versions across all `@gg-web-engine/*` packages.
- The Blender add-on in `blender-addon/` rides along on every engine release — this same pipeline
  (`release_action.yml`) builds and publishes it too, no separate tag needed. It does keep its own
  version number in `blender_manifest.toml`, though: bump that (and `bl_info["version"]`) yourself
  when `blender-addon/` actually changes, since a core/adapter version bump doesn't imply the add-on
  changed. Publishing an unchanged add-on version alongside a core/adapter release is a harmless
  no-op (Blender's Get Extensions UI just won't show an update). See `blender-addon/README.md`'s
  "Packaging / releasing" section.
- `blender_manifest.toml`'s `tagline` and every `[permissions]` value (e.g. `files`) are capped at
  64 characters by Blender's extension schema — `blender --command extension build`, which the
  "Build Blender add-on extension zip" release step runs, fails the whole job with a `FATAL_ERROR`
  per offending key if either is longer, even though nothing else in the release (npm publish,
  docs deploy) depends on it. When editing either field, count characters and stay at or under 64.

## Keep this skill current

This file is read by future agents cutting releases, not by end users of the engine. If the
pipeline behaves differently than described here (a new failure mode in `publish_new_version.sh`,
an npm propagation delay longer than the script accounts for, a manual follow-up this file
doesn't list), add a short note (what went wrong, why, the fix) before finishing — folded into the
relevant section rather than left as a loose log entry.
