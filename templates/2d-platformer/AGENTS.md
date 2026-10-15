# Notes for coding agents

This game is built on gg-web-engine (`@gg-web-engine/*` packages): pixi.js rendering through
`@gg-web-engine/pixi`, Rapier physics through `@gg-web-engine/rapier2d`, on-screen touch controls through
`@gg-web-engine/mobile-controls`.

Before writing engine code, read the engine guide (the same text in each place):

- `node_modules/@gg-web-engine/core/AGENTS.md`, shipped in the core package;
- https://andygura.github.io/gg-web-engine/llms-full.txt, the same guide on the docs site;
- always available: https://github.com/AndyGura/gg-web-engine/blob/main/.claude/skills/gg-engine-app-development/SKILL.md

API reference: https://andygura.github.io/gg-web-engine/

## Layout

- `src/main.ts` - creates the world, loads the level, attaches player control, kill zone and score. Gameplay code
  goes where it says "Add your gameplay here".
- `src/level.ts` - the level as a `LevelJson` object, loaded with `world.loader.loadLevel(...)`.
- `src/coin.ts` - the app-defined `Coin` entity class, registered with `world.loader.registerClass('Coin', ...)`.
- `public/backgrounds/` - background images used by the level's `ParallaxLayer` entries.
- `index.html` - the canvas (`#gg`) and the DOM score overlay.

## Commands

- `npm run dev` - development server
- `npm run build` - type-check (`tsc --noEmit`) and production build into `dist/`
- `npx tsc --noEmit` - type-check only
- `npm run preview` - serve the production build

## Conventions

- The 2D world is y-down: a smaller `y` is higher up. Sizes, speeds and gravity are in pixels. Use the `Pnt2`
  constants (`Pnt2.O`, `Pnt2.X`, `Pnt2.nY`, ...) where an axis or the origin is meant.
- Describe level content as data in `src/level.ts`; register new level classes with `world.loader.registerClass`.
- Import engine code only from `@gg-web-engine/*`. Do not import `pixi.js` or `@dimforge/*` directly, and do not use
  an adapter's `native*` members: that ties the game to one rendering or physics backend.
- Every new entity class declares `static readonly entityTypeName: string = 'ClassName';`.
- `GgStatic` (the dev console) is for development only: keep every use inside `if (import.meta.env.DEV) { ... }`
  so production builds leave it out.
