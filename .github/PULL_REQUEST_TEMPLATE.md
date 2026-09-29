<!--
Thanks for the PR. This repo squash-merges: the PR title becomes the commit subject on main
and the line people read in git log and the changelog, so make it a clear one-line summary.
Never prefix it with "[pre-release] [X.Y.Z]" — that string triggers a release.
See CONTRIBUTING.md for the full conventions.
-->

## Summary

<!-- What changes, and why. Link the issue it closes, if any: "Closes #123". -->

## Type of change

- [ ] Bug fix
- [ ] New feature or API
- [ ] Breaking change (existing app code would need to be updated — describe how below)
- [ ] Dependency upgrade
- [ ] Docs / examples / skills only
- [ ] Build, CI, or release tooling

## Packages touched

- [ ] core
- [ ] three
- [ ] pixi
- [ ] ammo
- [ ] rapier3d
- [ ] matter
- [ ] rapier2d
- [ ] audio
- [ ] blender-addon / e2e
- [ ] examples

## How it was tested

<!--
Which suites you ran (root `npm test`, a specific package), and — for anything visual or
physics-related — which example you ran it in and what you looked at.
-->

## Checklist

- [ ] `npm install` at the repo root, then `npm run build` and `npm test` pass locally (this is what CI runs).
- [ ] Code is formatted (`npm run prettier-format`).
- [ ] New or changed behavior has unit tests in the package that owns it.
- [ ] `CHANGELOG.md` has an entry under `[Unreleased]` (skip for internal refactors and doc-only changes).
- [ ] Relevant skill files under `.claude/skills/` describe the code as it now stands (skip if nothing they cover changed).
- [ ] `milestones.md` bullet updated in place, if this completes or advances a listed deliverable (no new bullets).
- [ ] Nothing under `documentation/` was edited by hand (it's regenerated on release).
- [ ] New entity classes declare `static readonly entityTypeName`.
- [ ] A new adapter package is added to `libs` in `etc/publish_new_version.sh` and to the root `tsconfig.json` `references`.
- [ ] A new example is added to `examples/examples-list.txt` (and `examples/index.html` if it should be publicly listed).
