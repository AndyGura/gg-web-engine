import { EntityJson, LevelJson, Point2 } from '@gg-web-engine/core';

// The level, described as data: `world.loader.loadLevel(LEVEL, ...)` in game.screen.ts turns every
// entry into an entity. Units are pixels; the 2D world is y-down, so a smaller `y` is higher up, and
// the ground's top surface sits at y = 0. A jump reaches about 150 px up and, walking, about 200 px
// across (hold Shift to run and jump farther).

/** where the player starts, and comes back to after losing a life before reaching a checkpoint */
export const SPAWN_POINT: Point2 = { x: 0, y: -60 };

/** the level's left and right ends (the outer faces of its walls): the camera stays between them */
export const LEVEL_BOUNDS = { left: -400, right: 3700 };

/** lives at the start of a game */
export const LIVES = 3;

const GROUND = 0x6b4f3a;
const GRASS = 0x5dae4b;
const PLATFORM = 0x9c6b45;
const WALL = 0x4a3728;

/** a static, solid box - ground, platforms, walls */
const box = (name: string, x: number, y: number, width: number, height: number, color: number): EntityJson => ({
  class: 'Primitive',
  shape: 'BOX',
  name,
  position: { x, y },
  config: { dimensions: { x: width, y: height }, material: { color }, body: { bodyType: 'static' } },
});

/** ground from `left` to `right`: a strip of grass on top of deep soil (its bottom stays off screen) */
const ground = (name: string, left: number, right: number): EntityJson[] => [
  box(`${name}Grass`, (left + right) / 2, 7, right - left, 14, GRASS),
  box(name, (left + right) / 2, 307, right - left, 586, GROUND),
];

/** a 24 px thick platform whose top surface is at `top` */
const platform = (name: string, x: number, top: number, width: number) => box(name, x, top + 12, width, 24, PLATFORM);

/**
 * A collectible coin (the app-defined "Coin" class, entities.ts). `onCollected` emits the coin
 * itself; the built-in "RemoveEntity" blueprint node removes (and disposes) whatever it receives.
 */
const coin = (x: number, y: number): EntityJson => ({
  class: 'Coin',
  position: { x, y },
  events: { onCollected: { type: 'RemoveEntity', settings: { dispose: true } } },
});

/** a row of spikes standing on the ground, `width` px wide, centered on `x` */
const spikes = (x: number, width: number): EntityJson => ({
  class: 'Spikes',
  position: { x, y: 0 },
  config: { width },
});

/** a slime walking back and forth on the ground between `from` and `to` */
const slime = (name: string, from: number, to: number, speed: number): EntityJson => ({
  class: 'Slime',
  name,
  config: { from, to, speed },
});

/** a flag planted on the ground: a checkpoint, or (`goal: true`) the end of the level */
const flag = (name: string, x: number, goal = false): EntityJson => ({
  class: 'Flag',
  name,
  position: { x, y: 0 },
  config: { goal },
});

export const LEVEL: LevelJson = {
  entities: [
    // --- solid geometry: three stretches of ground with two pits between them
    ...ground('Ground1', -400, 900),
    ...ground('Ground2', 1100, 2000),
    ...ground('Ground3', 2300, 3700),
    box('WallLeft', -380, -300, 40, 600, WALL),
    box('WallRight', 3680, -300, 40, 600, WALL),

    platform('PlatformA', 300, -122, 200),
    platform('PlatformB', 580, -232, 180),
    platform('PlatformC', 1000, -102, 160), // over the first pit
    platform('PlatformD', 1550, -122, 160),
    platform('PlatformE', 1800, -240, 140),
    platform('PlatformF', 2150, -102, 140), // a stepping stone over the second, wider pit
    platform('PlatformG', 2740, -122, 180),
    platform('PlatformH', 2990, -242, 160),
    platform('PlatformI', 3240, -362, 160),

    // --- hazards: touching spikes or a slime from the side costs a life; landing on a slime squashes it
    spikes(1300, 100),
    spikes(2600, 100),
    spikes(3420, 100),
    slime('Slime1', 550, 850, 80),
    slime('Slime2', 1450, 1950, 110),
    slime('Slime3', 2780, 3150, 90),

    // --- checkpoints after each pit, and the goal
    flag('Checkpoint1', 1160),
    flag('Checkpoint2', 2360),
    flag('Goal', 3560, true),

    // --- coins
    coin(300, -160),
    coin(580, -270),
    coin(760, -40),
    coin(1000, -140),
    coin(1300, -150),
    coin(1550, -160),
    coin(1800, -280),
    coin(2150, -140),
    coin(2600, -150),
    coin(2740, -160),
    coin(2990, -280),
    coin(3240, -400),
    coin(3420, -150),

    // --- the player: a capsule-bodied character; game.screen.ts attaches keyboard/camera control
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

    // --- kill zone: an invisible trigger below the level - falling into a pit costs a life
    { class: 'Trigger', name: 'KillZone', position: { x: 1650, y: 900 }, config: { dimensions: { x: 8000, y: 200 } } },
  ],
};
