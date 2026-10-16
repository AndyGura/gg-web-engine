import { EntityJson, LevelJson, Point3 } from '@gg-web-engine/core';

// The world is Z-up: {x, y} is the ground plane, +z is up. Units are meters.
//
// The route: a round base island, then a spiral of floating pads around an open center, climbing
// RISE meters per pad, up to a wide summit pad with the beacon. Every gap and rise is well inside
// what the player's jump (jumpSpeed 5.5 m/s, ~1.5 m apex, ~3.5 m of walking distance per jump)
// can clear.
const SPIRAL_RADIUS = 7;
const STEP_ANGLE = (36 * Math.PI) / 180;
const RISE = 0.9;
const PAD_RADIUS = 1.4;
const PAD_THICKNESS = 0.6;
const PAD_COUNT = 15; // pads 1..15, the summit is pad 16
const SUMMIT_RADIUS = 2.5;
const CHECKPOINT_PADS = [5, 10];
const CRYSTAL_PADS = [2, 4, 7, 9, 12, 14];

/** Center of the top surface of pad `i` (pad 0 is the base island at the origin). */
function padTop(i: number): Point3 {
  if (i === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  // pad 1 straight ahead of the spawn point (+y), then counter-clockwise
  const angle = Math.PI / 2 + (i - 1) * STEP_ANGLE;
  return { x: SPIRAL_RADIUS * Math.cos(angle), y: SPIRAL_RADIUS * Math.sin(angle), z: i * RISE };
}

/** A static round platform whose top surface is at `top`. */
function pad(name: string, top: Point3, radius: number, color: number): EntityJson {
  return {
    class: 'Primitive',
    shape: 'CYLINDER',
    name,
    position: { ...top, z: top.z - PAD_THICKNESS / 2 },
    config: {
      radius,
      height: PAD_THICKNESS,
      material: { color, shading: 'standart', castShadow: true, receiveShadow: true },
      body: { bodyType: 'static', friction: 1 },
    },
  };
}

/** Where the player respawns after a fall: the base, then each checkpoint pad, in climbing order. */
export const CHECKPOINTS: Point3[] = [0, ...CHECKPOINT_PADS].map(i => ({ ...padTop(i), z: padTop(i).z + 1 }));

/** The point the player has to touch (with every crystal collected) to win. */
export const BEACON: Point3 = { ...padTop(PAD_COUNT + 1), z: padTop(PAD_COUNT + 1).z + 1 };

/** How far below the last checkpoint reached a fall counts as lost. */
export const FALL_DEPTH = 6;

const pads: EntityJson[] = [];
for (let i = 1; i <= PAD_COUNT; i++) {
  const checkpoint = CHECKPOINT_PADS.includes(i);
  // checkpoint pads are bigger and teal, the rest alternate between two stone colors
  pads.push(
    pad(`Pad${i}`, padTop(i), checkpoint ? 1.8 : PAD_RADIUS, checkpoint ? 0x2a9d8f : i % 2 ? 0x8d99ae : 0x6d7a91),
  );
}

// Crystals are an app-defined level class ("Crystal", registered in game.screen.ts), floating a
// meter above their pad. The game finds them by this name prefix.
const crystals: EntityJson[] = CRYSTAL_PADS.map((i, n) => ({
  class: 'Crystal',
  name: `Crystal${n + 1}`,
  position: { ...padTop(i), z: padTop(i).z + 1 },
  config: { color: 0x4cc9f0 },
}));

const summit = padTop(PAD_COUNT + 1);

export const LEVEL: LevelJson = {
  entities: [
    {
      class: 'Light',
      name: 'Sky',
      config: { type: 'HEMISPHERE', color: 0xd7e9ff, groundColor: 0x3d3550, intensity: 1.1 },
    },
    {
      class: 'Light',
      name: 'Sun',
      position: { x: 14, y: -12, z: 34 },
      config: {
        type: 'DIRECTIONAL',
        color: 0xfff1d6,
        intensity: 1.6,
        castShadow: true,
        // one shadow map covering the whole tower
        shadow: { mapSize: 2048, area: 14, far: 90 },
        target: { x: 0, y: 0, z: 6 },
      },
    },
    // Fog hiding the bottomless drop below the tower, in the sky's horizon color. The sky itself is
    // a gradient painted at runtime (paintSky in effects.ts).
    {
      class: 'Environment',
      name: 'Env',
      config: { background: 0xc3a9c9, fog: { type: 'LINEAR', color: 0xc3a9c9, near: 22, far: 70 } },
    },

    // --- the climb ---------------------------------------------------------------------------
    pad('Base', padTop(0), 4, 0x7a9a6a),
    ...pads,
    pad('Summit', summit, SUMMIT_RADIUS, 0xe9c46a),
    ...crystals,

    // The beacon: a pillar on the summit with a big crystal on top. Its crystal stays dark until
    // every crystal is collected (game.screen.ts), then touching the pillar wins.
    {
      class: 'Primitive',
      shape: 'CYLINDER',
      name: 'BeaconPillar',
      position: { ...summit, z: summit.z + 0.6 },
      config: {
        radius: 0.35,
        height: 1.2,
        material: { color: 0x5e548e, shading: 'standart', castShadow: true, receiveShadow: true },
        body: { bodyType: 'static' },
      },
    },
    {
      class: 'Crystal',
      name: 'BeaconCrystal',
      position: { ...summit, z: summit.z + 2 },
      config: { color: 0xffd166, size: 2.2 },
    },

    // --- the player ----------------------------------------------------------------------------
    // A capsule character controller; the input/camera wiring is added in game.screen.ts.
    {
      class: 'Player',
      name: 'Player',
      position: CHECKPOINTS[0],
      config: {
        radius: 0.4,
        centersDistance: 1.0,
        walkSpeed: 4,
        runSpeedMultiplier: 1.6,
        jumpSpeed: 5.5,
        display: { color: 0xff7b00, shading: 'standart', castShadow: true, receiveShadow: true },
      },
    },
  ],
};
