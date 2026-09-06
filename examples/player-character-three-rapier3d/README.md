# player-character-three-rapier3d

Demonstrates `CharacterController3dEntity` + `PlayerCharacterController` from `@gg-web-engine/core`
(rendered with `@gg-web-engine/three`, physics via `@gg-web-engine/rapier3d`): a capsule-bodied,
physics-driven player character that walks/runs/crouches/jumps around a small hand-built room, with
mouse-look and a first-/third-person camera.

The level JSON builds a self-contained room out of six `"Primitive"` boxes (floor, ceiling, four
walls) plus a handful of obstacles purpose-built to exercise the controller: a box/sphere/cylinder
cluster to walk around, a low barrier to jump over, and an overhead beam whose gap only a crouched
capsule fits under - alongside a `"Camera"` and a `"Player"` entity. After the level loads,
`index.ts` looks up the spawned `CharacterController3dEntity` by name and wraps it with a
`PlayerCharacterController` to add keyboard/mouse input and camera control - the level JSON only
builds the physics+visual capsule, not that input wiring (see the `gg-engine-level-json` skill's
`"Player"` section for why).

## Controls

- `WASD` / arrow keys - move
- `Shift` - run
- `Ctrl` - crouch
- `Space` - jump
- Mouse - look around (click the canvas to lock the pointer)
- `V` - toggle first-/third-person camera

Press the backtick key (`` ` ``) to open the built-in dev console - `spawn` / `spawn <SHAPE> <x> <y>
<z>` drops physics props into the scene so you can test the player's collision against them.

## Note on engine version

This example is linked against the local, unpublished `packages/core`/`packages/rapier3d`/
`packages/three` build (via `etc/switch_example_to_local_gg.sh`) because the character-controller
feature it demonstrates hasn't been published to npm yet.
