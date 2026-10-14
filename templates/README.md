# Starter templates

Small, complete starting points for a game on gg-web-engine. Each one is a standalone Vite +
TypeScript project with a level, controls and a camera already wired, so `npm run dev` shows
something you can play and `src/main.ts` marks where your own gameplay goes.

```bash
npx degit AndyGura/gg-web-engine/templates/<template> my-game
cd my-game
npm install
npm run dev
```

| Template | What you get | Packages |
|---|---|---|
| [`3d-character`](3d-character) | A third-person character in a small arena: ramp, steps, obstacles, crates to push and a goal trigger | three, rapier3d |
| [`2d-platformer`](2d-platformer) | A side-view platformer: platforms, coins with a score counter, a kill zone and a parallax background, with on-screen touch controls | pixi, rapier2d, mobile-controls |
| [`multiplayer-cars`](multiplayer-cars) | A peer-to-peer driving arena: share the room link and drive together in one physics world, no game server | three, rapier3d, multiplayer |

Each template runs on one physics backend. Its README says how to switch to another one; expect to
retune physics after a switch, because the backends simulate differently (see the
[FAQ](https://github.com/AndyGura/gg-web-engine#-faq)).

Every template has an `AGENTS.md` for coding agents working in the generated project. It points them
at the engine guide and lists the project's conventions.

Templates pin the current engine version; the release script bumps it with every release.
