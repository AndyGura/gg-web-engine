import { EntityJson, LevelJson, Point2 } from '@gg-web-engine/core';

// The level, described as data. `world.loader.loadLevel(level, ...)` in main.ts turns every entry
// into an entity. Units are pixels; the 2D world is y-down, so a smaller `y` is higher up and the
// ground's top surface sits at y = 0.

/** where the player starts, and where it comes back to after falling into the pit */
export const SPAWN_POINT: Point2 = { x: 0, y: -60 };

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
    // camera moves (lower parallax reads as farther away; zIndex below 0 draws behind the level)
    { class: 'Environment', config: { background: 0x9fd3f0 } },
    {
      class: 'ParallaxLayer',
      name: 'Clouds',
      config: { texture: art('clouds.svg'), parallax: 0.1, zIndex: -3, offset: { x: 0, y: -430 } },
    },
    {
      class: 'ParallaxLayer',
      name: 'HillsFar',
      config: { texture: art('hills-far.svg'), parallax: 0.25, zIndex: -2, offset: { x: 0, y: -330 } },
    },
    {
      class: 'ParallaxLayer',
      name: 'HillsNear',
      config: { texture: art('hills-near.svg'), parallax: 0.5, zIndex: -1, offset: { x: 0, y: -260 } },
    },

    // --- ground (deep, so its bottom stays off screen), with a pit between x = 900 and x = 1100
    box('GroundLeft', 250, 300, 1300, 600, GROUND),
    box('GroundRight', 1750, 300, 1300, 600, GROUND),
    box('WallLeft', -380, -200, 40, 400, WALL),
    box('WallRight', 2380, -200, 40, 400, WALL),

    // --- platforms at different heights (a jump reaches about 150 px up)
    box('PlatformA', 300, -110, 200, 24, PLATFORM),
    box('PlatformB', 580, -220, 180, 24, PLATFORM),
    box('PlatformC', 1000, -150, 160, 24, PLATFORM), // over the pit
    box('PlatformD', 1450, -120, 200, 24, PLATFORM),
    box('PlatformE', 1750, -240, 160, 24, PLATFORM),
    box('PlatformF', 2050, -360, 140, 24, PLATFORM),

    // --- coins
    coin(300, -150),
    coin(580, -260),
    coin(1000, -190),
    coin(1450, -160),
    coin(1750, -280),
    coin(2050, -400),
    coin(800, -30),
    coin(2250, -30),

    // --- the player: a capsule-bodied character; main.ts attaches keyboard/camera control to it
    {
      class: 'Player',
      name: 'Player',
      position: SPAWN_POINT,
      config: {
        radius: 18,
        centersDistance: 36,
        walkSpeed: 260,
        runSpeedMultiplier: 1.8,
        jumpSpeed: 780,
        // pixel-scale fall acceleration (the physics world's own default gravity is meter-scale)
        gravity: 2000,
        airControlFactor: 0.4,
        display: { color: 0xe94f37, stroke: { color: 0x2b1d14, width: 3 } },
      },
    },

    // --- kill zone: an invisible trigger well below the level; main.ts respawns the player on entry
    {
      class: 'Trigger',
      name: 'KillZone',
      position: { x: 1000, y: 900 },
      config: { dimensions: { x: 6000, y: 200 } },
    },
  ],
};
