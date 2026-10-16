Write a level for gg-web-engine as a level JSON file (`level.json`, a `LevelJson` document that
`world.loader.loadLevel` loads). No TypeScript, no custom classes: only the engine's built-in level
classes.

The level: a short third-person obstacle course floating in the sky at sunset. The player starts on
a small grassy island, crosses a path of stone platforms over the void (a few gaps to jump, a
staircase, a narrow bridge, a couple of crates that can be pushed), and ends on a goal platform
with a glowing marker. It should take about a minute to play and every jump must be makeable.

The page that plays it expects these names:

- `Player`: the `"Player"` character the page drives with WASD, Space and the mouse.
- `MainCamera`: a `"Camera"` behind the player, looking along the course.
- `Goal`: a `"Trigger"` on the goal platform; entering it wins.
- `Checkpoint_1`, `Checkpoint_2`, ...: optional `"Trigger"`s; the player respawns at the last one
  entered after falling off.

Anything else (lights, fog, colors, decoration) is up to you.

---

## Changes after the agent's draft

- Added `"shading": "standart"` to the 31 materials that had no `shading`. The agent gave them
  `castShadow`/`receiveShadow` and lit the level with a sun, a sky light and a glow, expecting a lit
  material by default, but a material without `shading` is unlit: the whole level rendered in flat
  colors, without light or shadow. The level JSON guide now says so.

Nothing else changed: every position, size, jump and the Player tuning are the agent's draft.
