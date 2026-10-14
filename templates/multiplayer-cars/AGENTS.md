# Notes for coding agents

This is a multiplayer browser game built on [gg-web-engine](https://github.com/AndyGura/gg-web-engine)
(three.js rendering, Rapier physics, `@gg-web-engine/multiplayer` for peer-to-peer networking).

Before writing engine code, read the engine guide (the same text in each place):

- `node_modules/@gg-web-engine/core/AGENTS.md`, shipped in the core package by engine releases newer
  than 0.0.82;
- https://andygura.github.io/gg-web-engine/llms-full.txt, published with those same releases;
- always available: https://github.com/AndyGura/gg-web-engine/blob/main/.claude/skills/gg-engine-app-development/SKILL.md

API reference: https://andygura.github.io/gg-web-engine/

Multiplayer specifics: `node_modules/@gg-web-engine/multiplayer/README.md`.

## Layout

- `src/main.ts` - startup: world, signaling (Firebase by default, `?local` = BroadcastChannel), room
  id from the URL, shared level, this player's car (spawned, possessed), controls, HUD. Gameplay
  goes at the end.
- `src/level.ts` - the arena as level JSON (`LevelJson`), loaded on every peer with
  `net.loadSharedLevel`.
- `src/car.ts` - the `"GgCar"` entity description and the chase camera.

## Commands

- `npm run dev` - dev server (with the engine's dev console on the backquote key)
- `npm run build` - type-check (`tsc --noEmit`) and production build into `dist/`
- `npx tsc --noEmit` - type-check only
- test multiplayer locally: open `/?local`, then the room link it shows in a second tab

## Conventions

- 3D is Z-up: `{x, y}` is the ground, `+Z` is up. Use `Pnt3.X/Y/Z` for axes. A `GgCar`'s forward
  axis is `+Y`.
- Level content is data in `src/level.ts`. Every peer in a room must load the same level; shared
  content needs the same names on every peer, per-player things need peer-unique names (the car is
  `Car_<peerId>`).
- Consequences of events (scoring, removing things) must happen once per room: gate them with
  `net.hasAuthority(...)`, broadcast with `net.send(...)`, remove shared things with `net.despawn(...)`.
  Never use `Math.random()` for content every peer builds.
- Import engine code only from `@gg-web-engine/*`; don't import `three` or `@dimforge/*` directly or
  use an adapter's `native*` objects - it ties the game to one backend.
- Every new entity class declares `static readonly entityTypeName: string = 'ClassName';`.
- `GgStatic` (dev console) is development-only: keep every use inside `if (import.meta.env.DEV)`.
