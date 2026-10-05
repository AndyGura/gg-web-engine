import { LevelJson } from '@gg-web-engine/core';

const ASSETS = 'https://gg-web-demos.guraklgames.com/assets';
const ROOM_SIZE = 24;

const tree = (name: string, x: number, y: number) => ({
  class: 'Glb',
  name,
  position: { x, y, z: 0 },
  // every tree is the same file: fetched and parsed once, placed four times
  config: { path: `${ASSETS}/model-loader/christmas_tree`, castShadow: true },
});

const wall = (name: string, x: number, y: number, sizeX: number, sizeY: number) => ({
  class: 'Primitive',
  shape: 'BOX',
  name,
  position: { x, y, z: 1 },
  config: { dimensions: { x: sizeX, y: sizeY, z: 2 }, material: { color: 0x7d8597 }, body: { bodyType: 'static' } },
});

/**
 * Everything the game shows. The loader collects the files these entities need (the sky faces, the
 * tree and the character models, the music) and loads them together before building anything,
 * which is what gives the loading screen one progress for the whole level.
 */
export const LEVEL: LevelJson = {
  entities: [
    {
      class: 'Environment',
      name: 'Sky',
      config: {
        background: {
          cube: {
            px: `${ASSETS}/fly-city/sky_px.png`,
            nx: `${ASSETS}/fly-city/sky_nx.png`,
            py: `${ASSETS}/fly-city/sky_py.png`,
            ny: `${ASSETS}/fly-city/sky_ny.png`,
            pz: `${ASSETS}/fly-city/sky_pz.png`,
            nz: `${ASSETS}/fly-city/sky_nz.png`,
          },
        },
      },
    },
    { class: 'Light', name: 'Ambient', config: { type: 'AMBIENT', intensity: 0.7 } },
    {
      class: 'Light',
      name: 'Sun',
      position: { x: 15, y: -15, z: 25 },
      config: {
        type: 'DIRECTIONAL',
        color: 0xfffaf3,
        intensity: 1,
        castShadow: true,
        shadow: { mapSize: 2048, area: 20, far: 100 },
        target: { x: 0, y: 0, z: 0 },
      },
    },
    {
      class: 'Sound',
      name: 'Music',
      config: { path: `${ASSETS}/sfx/portal_radio.mp3`, spatial: false, loop: true, volume: 0.4, bus: 'music' },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'Floor',
      position: { x: 0, y: 0, z: -0.5 },
      config: {
        dimensions: { x: ROOM_SIZE, y: ROOM_SIZE, z: 1 },
        material: { color: 0x5c677d, receiveShadow: true },
        body: { bodyType: 'static', friction: 1.5 },
      },
    },
    wall('WallNorth', 0, ROOM_SIZE / 2, ROOM_SIZE, 0.5),
    wall('WallSouth', 0, -ROOM_SIZE / 2, ROOM_SIZE, 0.5),
    wall('WallEast', ROOM_SIZE / 2, 0, 0.5, ROOM_SIZE),
    wall('WallWest', -ROOM_SIZE / 2, 0, 0.5, ROOM_SIZE),
    tree('TreeA', -6, 4),
    tree('TreeB', 6, 4),
    tree('TreeC', -6, -4),
    tree('TreeD', 6, -4),
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'Crate',
      position: { x: 0, y: 3, z: 0.4 },
      config: {
        dimensions: { x: 0.8, y: 0.8, z: 0.8 },
        material: { color: 0x00b4d8, castShadow: true },
        body: { mass: 5 },
      },
    },
    {
      class: 'Primitive',
      shape: 'SPHERE',
      name: 'Ball',
      position: { x: 2, y: 3, z: 0.5 },
      config: { radius: 0.5, material: { color: 0xfb8500, castShadow: true }, body: { mass: 2 } },
    },
    {
      class: 'Player',
      name: 'Player',
      position: { x: 0, y: -6, z: 1.5 },
      config: {
        radius: 0.4,
        centersDistance: 1.0,
        walkSpeed: 4,
        runSpeedMultiplier: 1.8,
        jumpSpeed: 4,
        display: { model: { path: `${ASSETS}/characters/blockman` } },
      },
    },
  ],
};
