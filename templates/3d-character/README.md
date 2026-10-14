# 3D character starter

A minimal third-person character game on [gg-web-engine](https://github.com/AndyGura/gg-web-engine),
rendered with three.js (`@gg-web-engine/three`) and simulated with Rapier (`@gg-web-engine/rapier3d`).
You get a small walled arena described as level data: a floor, static obstacles of different shapes
(box, cylinder, sphere, cone), a ramp and a flight of steps up to two platforms, a sun with shadows,
sky color and fog, a few dynamic crates you can push around, a trigger volume on one platform, and a
capsule character driven by the engine's `PlayerCharacterController` with a third-person camera.
Built with Vite and TypeScript.

## Getting started

```bash
npx degit AndyGura/gg-web-engine/templates/3d-character my-game
cd my-game
npm install
npm run dev
```

`npm run build` type-checks and writes a production build to `dist/`; `npm run preview` serves it.

## Files

```
index.html      full-window canvas (#gg) and the controls hint
src/main.ts     creates the world, loads the level, wires the player controller; your gameplay goes at the bottom
src/level.ts    the level as data (a LevelJson): camera, lights, environment, arena, obstacles, crates, trigger, player
tsconfig.json
package.json
AGENTS.md       notes for AI coding agents working in this project
```

## Controls

| Input | Action |
|---|---|
| Click the canvas | lock the mouse pointer for mouse look (Esc releases it) |
| Mouse | look around |
| WASD / arrow keys | move |
| Shift | run |
| Space | jump |
| Ctrl | crouch |
| V | switch between third- and first-person view |
| ` (backquote) | engine dev console (`npm run dev` only) |

## Next steps

- **Gameplay**: the bottom of `src/main.ts` has two hooks to start from - a subscription to the
  `Goal` trigger's `onEntityEntered` (it logs when the player walks onto the yellow plate), and a
  per-tick callback from `createInlineTickController(world)`. Add level content in `src/level.ts`;
  give an entity a `name` there and look it up with `levelEntity.getChildEntityByName(name)`.
- **Dev console**: in `npm run dev`, press ` and try `commands`, `entities`, `set_position Player 0 0 3`,
  `spawn BOX 0 -4 3` or `debug_view 1`. It is left out of production builds.
- **Swapping the physics backend**: replace `@gg-web-engine/rapier3d` in `package.json` with another
  3D backend (`@gg-web-engine/ammo`, at the same version as the other `@gg-web-engine/*` packages) and
  change the one `physicsWorld: new Rapier3dWorldComponent()` line in `src/main.ts` (plus its import
  and the `Rapier3dGgWorld` type) to that package's world component (`AmmoWorldComponent`,
  `AmmoGgWorld`). Expect to retune physics values afterwards: backends simulate differently (character
  sliding, pushing, friction). See the [FAQ](https://github.com/AndyGura/gg-web-engine#-faq).

## Links

- API documentation: https://andygura.github.io/gg-web-engine/
- Demos: https://gg-web-demos.guraklgames.com/
