import { EntityJson, LevelJson, Point2 } from '@gg-web-engine/core';

// The level, described as data. `world.loader.loadLevel(level, ...)` in main.ts turns every entry
// into an entity. Units are meters (speeds m/s), as in a 3D world; the 2D world is y-down, so a
// smaller `y` is higher up and the ground's top surface sits at y = 0.

/** where the player starts, and where it comes back to after falling into the pit */
export const SPAWN_POINT: Point2 = { x: 0, y: -0.6 };

/** background art lives in `public/`; BASE_URL keeps the paths right when deployed under a sub-path */
const art = (file: string) => `${import.meta.env.BASE_URL}backgrounds/${file}`;

/** a static, solid box - ground, platforms, walls */
const box = (name: string, x: number, y: number, width: number, height: number, color: number): EntityJson => ({
  class: 'Primitive',
  shape: 'BOX',
  name,
  position: { x, y },
  config: { dimensions: { x: width, y: height }, material: { color }, body: { bodyType: 'static' } },
});

/** a collectible coin: the app-defined "Coin" class registered in coin.ts */
const coin = (x: number, y: number): EntityJson => ({
  class: 'Coin',
  position: { x, y },
  // `onCollected` emits the coin itself when the player touches it; the built-in "RemoveEntity"
  // blueprint node removes (and disposes) whatever it receives - so the coin disappears.
  events: { onCollected: { type: 'RemoveEntity', settings: { dispose: true } } },
});

const GROUND = 0x6b4f3a;
const PLATFORM = 0x9c6b45;
const WALL = 0x4a3728;

export const level: LevelJson = {
  entities: [
    // --- backdrop: a sky color, then three image layers scrolling slower than the world as the
    // camera moves (lower parallax reads as farther away; zIndex below 0 draws behind the level).
    // An image's own pixels set its size (100 px is 1 m), and `offset` is in meters
    { class: 'Environment', config: { background: 0x9fd3f0 } },
    {
      class: 'ParallaxLayer',
      name: 'Clouds',
      config: { texture: art('clouds.svg'), parallax: 0.1, zIndex: -3, offset: { x: 0, y: -4.3 } },
    },
    {
      class: 'ParallaxLayer',
      name: 'HillsFar',
      config: { texture: art('hills-far.svg'), parallax: 0.25, zIndex: -2, offset: { x: 0, y: -3.3 } },
    },
    {
      class: 'ParallaxLayer',
      name: 'HillsNear',
      config: { texture: art('hills-near.svg'), parallax: 0.5, zIndex: -1, offset: { x: 0, y: -2.6 } },
    },

    // --- ground (deep, so its bottom stays off screen), with a pit between x = 9 and x = 11
    box('GroundLeft', 2.5, 3, 13, 6, GROUND),
    box('GroundRight', 17.5, 3, 13, 6, GROUND),
    box('WallLeft', -3.8, -2, 0.4, 4, WALL),
    box('WallRight', 23.8, -2, 0.4, 4, WALL),

    // --- platforms at different heights (a jump reaches about 1.5 m up)
    box('PlatformA', 3, -1.1, 2, 0.24, PLATFORM),
    box('PlatformB', 5.8, -2.2, 1.8, 0.24, PLATFORM),
    box('PlatformC', 10, -1.5, 1.6, 0.24, PLATFORM), // over the pit
    box('PlatformD', 14.5, -1.2, 2, 0.24, PLATFORM),
    box('PlatformE', 17.5, -2.4, 1.6, 0.24, PLATFORM),
    box('PlatformF', 20.5, -3.6, 1.4, 0.24, PLATFORM),

    // --- coins
    coin(3, -1.5),
    coin(5.8, -2.6),
    coin(10, -1.9),
    coin(14.5, -1.6),
    coin(17.5, -2.8),
    coin(20.5, -4),
    coin(8, -0.3),
    coin(22.5, -0.3),

    // --- the player: a capsule-bodied character; main.ts attaches keyboard/camera control to it
    {
      class: 'Player',
      name: 'Player',
      position: SPAWN_POINT,
      config: {
        radius: 0.18,
        centersDistance: 0.36,
        walkSpeed: 2.6, // m/s
        runSpeedMultiplier: 1.8,
        jumpSpeed: 7.8, // m/s: about 1.5 m up under the 20 m/s² gravity main.ts sets
        airControlFactor: 0.4,
        display: { color: 0xe94f37, stroke: { color: 0x2b1d14, width: 3 } },
      },
    },

    // --- kill zone: an invisible trigger well below the level; main.ts respawns the player on entry
    {
      class: 'Trigger',
      name: 'KillZone',
      position: { x: 10, y: 9 },
      config: { dimensions: { x: 60, y: 2 } },
    },
  ],
};
