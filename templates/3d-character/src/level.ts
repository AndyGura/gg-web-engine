import { EntityJson, LevelJson, Qtrn } from '@gg-web-engine/core';

// The whole scene, described as data. `world.loader.loadLevel(level, ...)` in main.ts turns every
// entry into an entity. The world is Z-up: {x, y} is the ground, +z is up. Units are meters.
//
// Each entry has a `class` (a built-in like "Primitive", "Light", "Player", or one you register
// with `world.loader.registerClass`), an optional `name` to find it again with
// `level.getChildEntityByName(name)`, and class-specific `config`.

// Materials: `shading: 'standart'` (the engine's spelling) gives a lit, physically based material
// that reacts to the lights below; without `shading` a mesh is drawn unlit, in its flat color.
// `castShadow`/`receiveShadow` let it take part in the sun's shadows.

const ARENA = 24; // floor size
const WALL_HEIGHT = 1.5;

/** A static, shadow-casting box: walls, steps, platforms. */
function staticBox(
  name: string,
  position: EntityJson['position'],
  size: { x: number; y: number; z: number },
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
      dimensions: size,
      material: { color, shading: 'standart', castShadow: true, receiveShadow: true },
      body: { bodyType: 'static' },
    },
  };
}

/** A light dynamic crate the player can shove around. */
function crate(name: string, x: number, y: number, color: number, z = 0.4): EntityJson {
  return {
    class: 'Primitive',
    shape: 'BOX',
    name,
    position: { x, y, z },
    config: {
      dimensions: { x: 0.8, y: 0.8, z: 0.8 },
      material: { color, shading: 'standart', castShadow: true, receiveShadow: true },
      body: { bodyType: 'dynamic', mass: 2, friction: 0.6 },
    },
  };
}

// A ramp up to a platform: a long thin box tilted around the X axis, so its +y end rises.
const RAMP_ANGLE = 0.26; // ~15 degrees, well under the character's 50 degree climb limit
const PLATFORM_HEIGHT = 2;

// Five 0.25 m steps up to a second platform - each lower than the character's 0.3 m `maxStepHeight`.
const steps: EntityJson[] = [1, 2, 3, 4, 5].map(i =>
  staticBox(`Step${i}`, { x: 7, y: -6 + i * 0.8, z: (i * 0.25) / 2 }, { x: 3, y: 0.8, z: i * 0.25 }, 0xb08968),
);

export const level: LevelJson = {
  entities: [
    // --- camera, light, sky ---------------------------------------------------------------------
    // The PlayerCharacterController in main.ts moves this camera around the player. It keeps the
    // camera's starting view direction, so aim it the way the player should first look (+y, slightly down).
    {
      class: 'Camera',
      name: 'MainCamera',
      position: { x: 0, y: -14, z: 4 },
      rotation: Qtrn.lookAt({ x: 0, y: -14, z: 4 }, { x: 0, y: 0, z: 0 }),
      config: { fov: 70 },
    },
    // Sky/ground ambient fill plus a sun that casts shadows over the whole arena.
    {
      class: 'Light',
      name: 'Sky',
      config: { type: 'HEMISPHERE', color: 0xcfe8ff, groundColor: 0x6b5a45, intensity: 1.2 },
    },
    {
      class: 'Light',
      name: 'Sun',
      position: { x: 12, y: -10, z: 20 },
      config: {
        type: 'DIRECTIONAL',
        color: 0xfff4e0,
        intensity: 1.6,
        castShadow: true,
        shadow: { mapSize: 2048, area: 18, far: 60 },
        target: { x: 0, y: 0, z: 0 },
      },
    },
    {
      class: 'Environment',
      name: 'Env',
      config: { background: 0x9cc8eb, fog: { type: 'LINEAR', color: 0x9cc8eb, near: 25, far: 70 } },
    },

    // --- arena: floor and four walls ------------------------------------------------------------
    staticBox('Floor', { x: 0, y: 0, z: -0.5 }, { x: ARENA, y: ARENA, z: 1 }, 0x7a9a6a),
    staticBox(
      'WallNorth',
      { x: 0, y: ARENA / 2, z: WALL_HEIGHT / 2 },
      { x: ARENA + 0.6, y: 0.6, z: WALL_HEIGHT },
      0x8d8d8d,
    ),
    staticBox(
      'WallSouth',
      { x: 0, y: -ARENA / 2, z: WALL_HEIGHT / 2 },
      { x: ARENA + 0.6, y: 0.6, z: WALL_HEIGHT },
      0x8d8d8d,
    ),
    staticBox('WallEast', { x: ARENA / 2, y: 0, z: WALL_HEIGHT / 2 }, { x: 0.6, y: ARENA, z: WALL_HEIGHT }, 0x8d8d8d),
    staticBox('WallWest', { x: -ARENA / 2, y: 0, z: WALL_HEIGHT / 2 }, { x: 0.6, y: ARENA, z: WALL_HEIGHT }, 0x8d8d8d),

    // --- static obstacles in a few shapes -------------------------------------------------------
    staticBox('Pillar', { x: 3, y: 4, z: 1 }, { x: 1.5, y: 1.5, z: 2 }, 0x6c757d),
    {
      class: 'Primitive',
      shape: 'CYLINDER',
      name: 'Column',
      position: { x: -3, y: 5, z: 1.25 },
      config: {
        radius: 0.7,
        height: 2.5,
        material: { color: 0x2a9d8f, shading: 'standart', castShadow: true, receiveShadow: true },
        body: { bodyType: 'static' },
      },
    },
    {
      class: 'Primitive',
      shape: 'SPHERE',
      name: 'Boulder',
      position: { x: 0, y: 8, z: 0.4 },
      config: {
        radius: 1.2,
        material: { color: 0xc1121f, shading: 'standart', castShadow: true, receiveShadow: true },
        body: { bodyType: 'static' },
      },
    },
    {
      class: 'Primitive',
      shape: 'CONE',
      name: 'Cone',
      position: { x: 5, y: 8, z: 1 },
      config: {
        radius: 0.8,
        height: 2,
        material: { color: 0xf4a261, shading: 'standart', castShadow: true, receiveShadow: true },
        body: { bodyType: 'static' },
      },
    },

    // --- a ramp and some steps up to two platforms ----------------------------------------------
    staticBox(
      'Ramp',
      { x: -7, y: -2, z: 0.77 },
      { x: 3, y: 8, z: 0.4 },
      0xb08968,
      Qtrn.fromEuler({ x: RAMP_ANGLE, y: 0, z: 0 }),
    ),
    staticBox('RampPlatform', { x: -7, y: 3.86, z: PLATFORM_HEIGHT / 2 }, { x: 4, y: 4, z: PLATFORM_HEIGHT }, 0x9c6644),
    ...steps,
    staticBox('StepsPlatform', { x: 7, y: -0.1, z: 0.75 }, { x: 3, y: 3, z: 1.5 }, 0x9c6644),

    // --- a trigger volume: main.ts reacts when the player walks into it --------------------------
    // Triggers are invisible physics sensors; this thin plate just marks where it is.
    staticBox('GoalMarker', { x: -7, y: 4.5, z: PLATFORM_HEIGHT + 0.02 }, { x: 1.6, y: 1.6, z: 0.04 }, 0xffd166),
    {
      class: 'Trigger',
      name: 'Goal',
      position: { x: -7, y: 4.5, z: PLATFORM_HEIGHT + 0.75 },
      config: { dimensions: { x: 1.6, y: 1.6, z: 1.5 } },
    },

    // --- dynamic crates: walk into them to push them --------------------------------------------
    crate('Crate1', -2, -3, 0x90e0ef),
    crate('Crate2', -1, -3, 0x00b4d8),
    crate('Crate3', 0, -3, 0x0096c7),
    crate('Crate4', -1.5, -3, 0x48cae4, 1.2), // stacked on the two below
    crate('Crate5', -0.5, -2.2, 0x0077b6),

    // --- the player: a capsule-shaped character controller --------------------------------------
    // The input/camera wiring (PlayerCharacterController) is added in main.ts, because it needs
    // the canvas and the renderer.
    {
      class: 'Player',
      name: 'Player',
      position: { x: 0, y: -8, z: 1.2 },
      config: {
        radius: 0.4,
        centersDistance: 1.0,
        walkSpeed: 4,
        runSpeedMultiplier: 1.8,
        jumpSpeed: 5,
        display: { color: 0xff7b00, shading: 'standart', castShadow: true, receiveShadow: true },
      },
    },
  ],
};
