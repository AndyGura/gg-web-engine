# Multiplayer cars

A minimal serverless multiplayer driving starter for [gg-web-engine](https://github.com/AndyGura/gg-web-engine):
a flat arena with ramps, crates and cones that every player can knock around (one shared physics
world), and one procedurally built car per player, driven with the keyboard and followed by a chase
camera. Rendering is three.js (`@gg-web-engine/three`), physics is Rapier (`@gg-web-engine/rapier3d`),
networking is `@gg-web-engine/multiplayer`: peers connect directly to each other over WebRTC, and
only find each other through a signaling service (Firebase Realtime Database by default). There is
no game server.

## Getting started

```bash
npx degit AndyGura/gg-web-engine/templates/multiplayer-cars my-game
cd my-game
npm install
npm run dev
```

Open the printed URL. The page puts a room id into the address bar (`?room=...`); that URL, also
shown in the overlay, is the link to share. Everyone who opens it joins the same room (2-8 players).

To try it without any network, add `?local` to the URL (e.g. `http://localhost:5173/?local`) and
open the resulting room link in a second tab of the same browser: `?local` switches signaling to
`BroadcastChannel`, which only connects tabs of one browser.

Other commands: `npm run build` (type-check, then a production build into `dist/`),
`npm run preview` (serve that build). `dist/` is static files and can be hosted anywhere.

## Signaling: whose Firebase project this uses

By default `new FirebaseSignaling()` connects to **the engine maintainer's shared public Firebase
project** (`DEFAULT_FIREBASE_CONFIG` in `@gg-web-engine/multiplayer`). Its config is public by
design, and it is fine for trying things out, but it is shared with everybody else using the
default and comes with no guarantees. For a real game, use your own Firebase project:

1. Create a Firebase project, enable **Anonymous** authentication and the **Realtime Database**.
2. Deploy the database rules the package relies on, from
   [`packages/multiplayer/firebase`](https://github.com/AndyGura/gg-web-engine/tree/main/packages/multiplayer/firebase)
   in the engine repo (its README has the steps; everything runs on the free Spark plan).
   Optionally enable App Check and pass `appCheckSiteKey`.
3. Pass your web config in `src/main.ts`:

   ```typescript
   const signaling = new FirebaseSignaling({
     config: {
       apiKey: '...',
       authDomain: '...',
       databaseURL: '...',
       projectId: '...',
       appId: '...',
     },
   });
   ```

See the [`@gg-web-engine/multiplayer` README](https://github.com/AndyGura/gg-web-engine/tree/main/packages/multiplayer)
for the details. Two things to know about peer-to-peer: players' IP addresses are visible to each
other, and some networks can't connect directly - for those, pass your own TURN server to
`WebRtcMeshTransport` (`iceServers`, and `iceTransportPolicy: 'relay'` to always relay).

## Files

```
index.html      full-window canvas and the room overlay
src/main.ts     startup: world, signaling, room, shared level, your car, controls, HUD
src/level.ts    the arena as level JSON (floor, walls, ramps, crates, cones, lights)
src/car.ts      the car's description for the built-in "GgCar" class, and the chase camera
```

## Controls

- Arrows / WASD: throttle, brake (hold "down" at a standstill to reverse), steering
- Space: handbrake
- Backquote (`` ` ``): the engine's dev console, in `npm run dev` only (try `net_status`, `net_panel`)

## How the multiplayer part works

- Every peer simulates the whole world. Each networked entity has one owner whose state wins; the
  other peers' copies are corrected toward it.
- The arena is loaded with `net.loadSharedLevel(...)`: every peer builds it itself from
  `src/level.ts`, so all peers in a room must run the same level. Crates and cones are owned by
  whoever is nearest.
- Each player's car is a runtime spawn (`world.loader.createEntity({ class: 'GgCar', ... })` and
  `world.addEntity`), so it is rebuilt on every peer. `net.possess(car)` makes this peer drive it.
- When a player leaves, the peer that takes over their car removes it.

## Next steps

- Gameplay goes at the end of `src/main.ts`. For anything that should happen once for the whole
  room (scoring, removing a pickup), check `net.hasAuthority(...)` and broadcast the result with
  `net.send(...)` / `net.appMessages$`, or remove shared things with `net.despawn(...)`. Give late
  joiners the game state through `net.joinState`.
- Change the arena in `src/level.ts`, the car's tuning in `src/car.ts`.
- Swapping the physics backend: replace `@gg-web-engine/rapier3d` in `package.json` with another 3D
  physics package (e.g. `@gg-web-engine/ammo`, same version) and change the one
  `new Rapier3dWorldComponent()` line (and its type) in `src/main.ts`. Expect to retune physics -
  backends simulate differently (see the
  [FAQ](https://github.com/AndyGura/gg-web-engine#-faq)). Every peer in a room must use the same
  backend.

## Links

- API docs: https://andygura.github.io/gg-web-engine/
- Demos: https://gg-web-demos.guraklgames.com/
