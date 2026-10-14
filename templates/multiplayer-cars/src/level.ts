import { EntityJson, LevelJson, Qtrn } from '@gg-web-engine/core';

// The arena, described as data. Every peer loads this same document itself (see `net.loadSharedLevel`
// in main.ts), so its entities are *shared content*: identical names on every peer, only their state
// (position, velocity) travels over the network. Change it freely - but every peer in a room must
// run the same version, a joiner with a different level is refused.
//
// The world is Z-up: {x, y} is the ground, +Z is up. Sizes are meters, masses kilograms.

/** Half the side of the square arena, meters. */
export const ARENA_HALF_SIZE = 60;

const STATIC = { bodyType: 'static', mass: 0 } as const;
// `shading: 'standart'` (the engine's spelling) gives lit, shadow-receiving materials; the default
// is 'unlit' flat color.

function staticBox(
  name: string,
  position: EntityJson['position'],
  dimensions: object,
  color: number,
  rotation?: EntityJson['rotation'],
): EntityJson {
  return {
    class: 'Primitive',
    shape: 'BOX',
    name,
    position,
    rotation,
    config: {
      dimensions,
      material: { color, shading: 'standart', receiveShadow: true, castShadow: true },
      body: STATIC,
    },
  };
}

// --- the ground and four walls around it
const ground: EntityJson[] = [
  staticBox('Floor', { x: 0, y: 0, z: -0.5 }, { x: ARENA_HALF_SIZE * 2, y: ARENA_HALF_SIZE * 2, z: 1 }, 0x5a6b55),
  staticBox('WallN', { x: 0, y: ARENA_HALF_SIZE, z: 1 }, { x: ARENA_HALF_SIZE * 2, y: 1, z: 2 }, 0x8a8f99),
  staticBox('WallS', { x: 0, y: -ARENA_HALF_SIZE, z: 1 }, { x: ARENA_HALF_SIZE * 2, y: 1, z: 2 }, 0x8a8f99),
  staticBox('WallE', { x: ARENA_HALF_SIZE, y: 0, z: 1 }, { x: 1, y: ARENA_HALF_SIZE * 2, z: 2 }, 0x8a8f99),
  staticBox('WallW', { x: -ARENA_HALF_SIZE, y: 0, z: 1 }, { x: 1, y: ARENA_HALF_SIZE * 2, z: 2 }, 0x8a8f99),
];

// --- four ramps, one on each side, rising away from the center
const RAMP_PITCH = 0.25; // radians
const ramps: EntityJson[] = [
  staticBox(
    'RampN',
    { x: 0, y: 30, z: 1 },
    { x: 6, y: 10, z: 0.5 },
    0xc98b3a,
    Qtrn.fromEuler({ x: RAMP_PITCH, y: 0, z: 0 }),
  ),
  staticBox(
    'RampS',
    { x: 0, y: -30, z: 1 },
    { x: 6, y: 10, z: 0.5 },
    0xc98b3a,
    Qtrn.fromEuler({ x: -RAMP_PITCH, y: 0, z: 0 }),
  ),
  staticBox(
    'RampE',
    { x: 30, y: 0, z: 1 },
    { x: 10, y: 6, z: 0.5 },
    0xc98b3a,
    Qtrn.fromEuler({ x: 0, y: -RAMP_PITCH, z: 0 }),
  ),
  staticBox(
    'RampW',
    { x: -30, y: 0, z: 1 },
    { x: 10, y: 6, z: 0.5 },
    0xc98b3a,
    Qtrn.fromEuler({ x: 0, y: RAMP_PITCH, z: 0 }),
  ),
];

// --- dynamic props to knock around: a pyramid of crates in the middle and a ring of cones.
// Dynamic bodies are simulated by every peer and owned (broadcast) by whoever is nearest.
const crates: EntityJson[] = [];
for (const [layer, size] of [
  [0, 3],
  [1, 2],
  [2, 1],
] as const) {
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      crates.push({
        class: 'Primitive',
        shape: 'BOX',
        name: `Crate_${layer}_${i}_${j}`,
        position: { x: (i - (size - 1) / 2) * 1.05, y: (j - (size - 1) / 2) * 1.05, z: 0.5 + layer * 1.01 },
        config: {
          dimensions: { x: 1, y: 1, z: 1 },
          material: { color: 0xb07a43, shading: 'standart', castShadow: true, receiveShadow: true },
          body: { bodyType: 'dynamic', mass: 15 },
        },
      });
    }
  }
}

const CONES = 10;
const cones: EntityJson[] = Array.from({ length: CONES }, (_, i) => {
  const angle = (i / CONES) * Math.PI * 2;
  return {
    class: 'Primitive',
    shape: 'CONE',
    name: `Cone_${i}`,
    position: { x: Math.cos(angle) * 6, y: Math.sin(angle) * 6, z: 0.4 },
    config: {
      radius: 0.3,
      height: 0.8,
      material: { color: 0xff6a13, shading: 'standart', castShadow: true },
      body: { bodyType: 'dynamic', mass: 3 },
    },
  };
});

export const level: LevelJson = {
  entities: [
    {
      class: 'Environment',
      name: 'Sky',
      config: { background: 0x9fc7e8, fog: { type: 'LINEAR', color: 0x9fc7e8, near: 60, far: 160 } },
    },
    {
      class: 'Light',
      name: 'Ambient',
      config: { type: 'HEMISPHERE', color: 0xffffff, groundColor: 0x445533, intensity: 1.2 },
    },
    {
      class: 'Light',
      name: 'Sun',
      position: { x: 30, y: -20, z: 50 },
      config: {
        type: 'DIRECTIONAL',
        intensity: 2,
        castShadow: true,
        shadow: { mapSize: 2048, area: 70 },
        target: { x: 0, y: 0, z: 0 },
      },
    },
    ...ground,
    ...ramps,
    ...crates,
    ...cones,
  ],
};
