import { EntityJson, LevelJson, Point2 } from '@gg-web-engine/core';

// The level, described as data: `world.loader.loadLevel(LEVEL, ...)` in game.screen.ts turns every
// entry into an entity. Units are meters (speeds m/s); the 2D world is y-down, so a smaller `y` is
// higher up, and the ground's top surface sits at y = 0. A jump reaches about 1.5 m up and, walking,
// about 2 m across (hold Shift to run and jump farther).

/** where the player starts, and comes back to after losing a life before reaching a checkpoint */
export const SPAWN_POINT: Point2 = { x: 0, y: -0.6 };

/** the level's left and right ends (the outer faces of its walls): the camera stays between them */
export const LEVEL_BOUNDS = { left: -4, right: 37 };

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
  box(`${name}Grass`, (left + right) / 2, 0.07, right - left, 0.14, GRASS),
  box(name, (left + right) / 2, 3.07, right - left, 5.86, GROUND),
];

/** a 0.24 m thick platform whose top surface is at `top` */
const platform = (name: string, x: number, top: number, width: number) =>
  box(name, x, top + 0.12, width, 0.24, PLATFORM);

/**
 * A collectible coin (the app-defined "Coin" class, entities.ts). `onCollected` emits the coin
 * itself; the built-in "RemoveEntity" blueprint node removes (and disposes) whatever it receives.
 */
const coin = (x: number, y: number): EntityJson => ({
  class: 'Coin',
  position: { x, y },
  events: { onCollected: { type: 'RemoveEntity', settings: { dispose: true } } },
});

/** a row of spikes standing on the ground, `width` meters wide, centered on `x` */
const spikes = (x: number, width: number): EntityJson => ({
  class: 'Spikes',
  position: { x, y: 0 },
  config: { width },
});

/** a slime walking back and forth on the ground between `from` and `to`, at `speed` m/s */
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
    ...ground('Ground1', -4, 9),
    ...ground('Ground2', 11, 20),
    ...ground('Ground3', 23, 37),
    box('WallLeft', -3.8, -3, 0.4, 6, WALL),
    box('WallRight', 36.8, -3, 0.4, 6, WALL),

    platform('PlatformA', 3, -1.22, 2),
    platform('PlatformB', 5.8, -2.32, 1.8),
    platform('PlatformC', 10, -1.02, 1.6), // over the first pit
    platform('PlatformD', 15.5, -1.22, 1.6),
    platform('PlatformE', 18, -2.4, 1.4),
    platform('PlatformF', 21.5, -1.02, 1.4), // a stepping stone over the second, wider pit
    platform('PlatformG', 27.4, -1.22, 1.8),
    platform('PlatformH', 29.9, -2.42, 1.6),
    platform('PlatformI', 32.4, -3.62, 1.6),

    // --- hazards: touching spikes or a slime from the side costs a life; landing on a slime squashes it
    spikes(13, 1),
    spikes(26, 1),
    spikes(34.2, 1),
    slime('Slime1', 5.5, 8.5, 0.8),
    slime('Slime2', 14.5, 19.5, 1.1),
    slime('Slime3', 27.8, 31.5, 0.9),

    // --- checkpoints after each pit, and the goal
    flag('Checkpoint1', 11.6),
    flag('Checkpoint2', 23.6),
    flag('Goal', 35.6, true),

    // --- coins
    coin(3, -1.6),
    coin(5.8, -2.7),
    coin(7.6, -0.4),
    coin(10, -1.4),
    coin(13, -1.5),
    coin(15.5, -1.6),
    coin(18, -2.8),
    coin(21.5, -1.4),
    coin(26, -1.5),
    coin(27.4, -1.6),
    coin(29.9, -2.8),
    coin(32.4, -4),
    coin(34.2, -1.5),

    // --- the player: a capsule-bodied character; game.screen.ts attaches keyboard/camera control
    {
      class: 'Player',
      name: 'Player',
      position: SPAWN_POINT,
      config: {
        radius: 0.18,
        centersDistance: 0.36,
        walkSpeed: 2.6, // m/s
        runSpeedMultiplier: 1.8,
        jumpSpeed: 7.8, // m/s: about 1.5 m up under the 20 m/s² gravity game.screen.ts sets
        airControlFactor: 0.4,
        display: { color: 0xe94f37, stroke: { color: 0x2b1d14, width: 3 } },
      },
    },

    // --- kill zone: an invisible trigger below the level - falling into a pit costs a life
    { class: 'Trigger', name: 'KillZone', position: { x: 16.5, y: 9 }, config: { dimensions: { x: 80, y: 2 } } },
  ],
};
