# Notes for coding agents

This game is built on [gg-web-engine](https://github.com/AndyGura/gg-web-engine): `@gg-web-engine/core`
plus `@gg-web-engine/three` (rendering) and `@gg-web-engine/rapier3d` (physics).

Before writing engine code, read the engine guide (the same text in each place):

- `node_modules/@gg-web-engine/core/AGENTS.md`, shipped in the core package;
- https://andygura.github.io/gg-web-engine/llms-full.txt, the same guide on the docs site;
- always available: https://github.com/AndyGura/gg-web-engine/blob/main/.claude/skills/gg-engine-app-development/SKILL.md

API reference: https://andygura.github.io/gg-web-engine/

## Layout

- `src/main.ts` - creates the world, loads the level, adds the renderer and the
  `PlayerCharacterController`; gameplay hooks (trigger subscription, per-tick callback) at the bottom.
- `src/level.ts` - the level as a `LevelJson` (built-in classes `Camera`, `Light`, `Environment`,
  `Primitive`, `Trigger`, `Player`), loaded with `world.loader.loadLevel(level, 'MainLevel')`.
- `index.html` - the `<canvas id="gg">` the renderer draws into.

## Commands

- `npm run dev` - dev server (with the engine dev console on the backquote key)
- `npm run build` - type-check (`tsc --noEmit`) and production build into `dist/`
- `npx tsc --noEmit` - type-check only
- `npm run preview` - serve the production build

## Conventions

- 3D is Z-up: `{x, y}` is the ground plane, `+z` is up. Use `Pnt3.X`/`Pnt3.Y`/`Pnt3.Z` (and
  `Pnt3.nX`/...) when you mean an axis.
- Put static level content in `src/level.ts` as level JSON rather than imperative calls in `main.ts`.
- Import engine functionality only from `@gg-web-engine/*`. Do not import `three` or `@dimforge/*`
  directly and do not use adapters' `native*` properties; that ties the game to one backend.
- Every entity class you write declares `static readonly entityTypeName: string = 'ClassName';`.
- `GgStatic` (dev console, debug panel) is for development only: keep every use inside
  `if (import.meta.env.DEV) { ... }` so the production build drops it.
