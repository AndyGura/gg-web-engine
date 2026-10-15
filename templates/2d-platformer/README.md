# 2D platformer starter

A minimal side-view platformer built on [gg-web-engine](https://github.com/AndyGura/gg-web-engine), rendered with
pixi.js (`@gg-web-engine/pixi`) and simulated with Rapier (`@gg-web-engine/rapier2d`). You get a level described as
data (ground, platforms at different heights, a pit, a three-layer parallax background), a capsule player that walks,
runs and jumps with the camera following it, coins that disappear when touched and count into a score shown in a DOM
overlay, and a kill zone under the level that sends the player back to the start. All visuals are colored shapes and
three small placeholder SVGs, ready to be replaced with your own art.

## Getting started

```bash
npx degit AndyGura/gg-web-engine/templates/2d-platformer my-game
cd my-game
npm install
npm run dev
```

`npm run build` type-checks and writes a production build to `dist/`; `npm run preview` serves that build.

## Files

```
index.html               the page: a full-window canvas and the score overlay
public/backgrounds/      placeholder background images (SVG) used by the parallax layers
src/main.ts              creates the world, loads the level, wires up the player, kill zone and score
src/level.ts             the level as data (LevelJson): backdrop, ground, platforms, coins, player, kill zone
src/coin.ts              the "Coin" entity class the level uses: a round trigger with a spinning disc
AGENTS.md                notes for AI coding agents working in this project
```

## Controls

| Action | Keys |
| --- | --- |
| Move | Arrow keys or A / D |
| Run | Left Shift (hold) |
| Jump | Space |

On touch devices, on-screen buttons appear (`@gg-web-engine/mobile-controls`).

In a development build (`npm run dev`), the backquote key (`` ` ``) opens the engine's dev console; type `commands`
to list what it can do. It is not included in production builds.

## Next steps

- **Add gameplay** where `src/main.ts` says "Add your gameplay here". New level content goes into `src/level.ts`;
  new kinds of level objects are registered with `world.loader.registerClass(...)`, the way `src/coin.ts` does it.
- **Swap the physics backend.** The other 2D backend is `@gg-web-engine/matter`: replace `@gg-web-engine/rapier2d`
  in `package.json` with it (same version), then change the import and the one constructor line in `src/main.ts`
  (`new Rapier2dWorldComponent()` becomes `new MatterWorldComponent()`, and the `Rapier2dGgWorld` type becomes
  `MatterGgWorld`). Physics backends simulate differently, so expect to retune speeds, jump and gravity values; see
  the [FAQ](https://github.com/AndyGura/gg-web-engine#-faq).
- **Replace the art.** Swap the SVGs in `public/backgrounds/` for your own images (any format the browser decodes),
  or change the colors in `src/level.ts`.

## Links

- API docs: https://andygura.github.io/gg-web-engine/
- Demos: https://gg-web-demos.guraklgames.com/
- Engine repository: https://github.com/AndyGura/gg-web-engine
