import {
  Camera3dEntity,
  CharacterController3dEntity,
  Entity3d,
  Gg3dWorld,
  GgStatic,
  LevelJson,
  LoadingScreen,
  PlayerCharacterController,
  Pnt3,
} from '@gg-web-engine/core';
import { MobileControls } from '@gg-web-engine/mobile-controls';
import { ThreeGgWorld, ThreeSceneComponent, ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { createPhysicsWorld } from './backends';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

const ROOM_SIZE = 20;
const WALL_HEIGHT = 4;

const level: LevelJson = {
  entities: [
    {
      class: 'Camera',
      name: 'MainCamera',
      position: { x: 0, y: -8, z: 4 },
      rotation: { x: 0.7071067811865476, y: 0, z: 0, w: 0.7071067811865476 },
      config: { frustrum: { near: 0.05, far: 1000 } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'Floor',
      position: { x: 0, y: 0, z: -0.5 },
      config: {
        dimensions: { x: ROOM_SIZE, y: ROOM_SIZE, z: 1 },
        material: { color: 0x808080 },
        body: { bodyType: 'static', friction: 1.5 },
      },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'Ceiling',
      position: { x: 0, y: 0, z: WALL_HEIGHT + 0.5 },
      config: { dimensions: { x: ROOM_SIZE, y: ROOM_SIZE, z: 1 }, material: { color: 0xa0a0a0 }, body: { bodyType: 'static' } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'WallNorth',
      position: { x: 0, y: ROOM_SIZE / 2, z: WALL_HEIGHT / 2 },
      config: {
        dimensions: { x: ROOM_SIZE + 0.5, y: 0.5, z: WALL_HEIGHT },
        material: { color: 0x909090 },
        body: { bodyType: 'static' },
      },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'WallSouth',
      position: { x: 0, y: -ROOM_SIZE / 2, z: WALL_HEIGHT / 2 },
      config: {
        dimensions: { x: ROOM_SIZE + 0.5, y: 0.5, z: WALL_HEIGHT },
        material: { color: 0x909090 },
        body: { bodyType: 'static' },
      },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'WallEast',
      position: { x: ROOM_SIZE / 2, y: 0, z: WALL_HEIGHT / 2 },
      config: {
        dimensions: { x: 0.5, y: ROOM_SIZE + 0.5, z: WALL_HEIGHT },
        material: { color: 0x909090 },
        body: { bodyType: 'static' },
      },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'WallWest',
      position: { x: -ROOM_SIZE / 2, y: 0, z: WALL_HEIGHT / 2 },
      config: {
        dimensions: { x: 0.5, y: ROOM_SIZE + 0.5, z: WALL_HEIGHT },
        material: { color: 0x909090 },
        body: { bodyType: 'static' },
      },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'Pillar',
      position: { x: 6, y: 0, z: 1 },
      config: { dimensions: { x: 2, y: 2, z: 2 }, material: { color: 0x606060 }, body: { bodyType: 'static' } },
    },
    {
      class: 'Primitive',
      shape: 'SPHERE',
      name: 'Boulder',
      position: { x: 6, y: -4, z: 1 },
      config: { radius: 1, material: { color: 0xd62828 }, body: { bodyType: 'static' } },
    },
    {
      class: 'Primitive',
      shape: 'CYLINDER',
      name: 'Column',
      position: { x: 6, y: 4, z: 1 },
      config: { radius: 0.8, height: 2, material: { color: 0x2a9d8f }, body: { bodyType: 'static' } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'JumpBarrier',
      position: { x: 0, y: -3, z: 0.3 },
      config: { dimensions: { x: 4, y: 0.6, z: 0.6 }, material: { color: 0xf4a261 }, body: { bodyType: 'static' } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'CrouchBeam',
      position: { x: 0, y: 3, z: 2.1 },
      config: { dimensions: { x: 4, y: 1.0, z: 1.0 }, material: { color: 0x8338ec }, body: { bodyType: 'static' } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'CrateLight',
      position: { x: -3, y: -5, z: 0.4 },
      config: { dimensions: { x: 0.8, y: 0.8, z: 0.8 }, material: { color: 0x90e0ef }, body: { mass: 0.2 } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'CrateMedium',
      position: { x: -3, y: -3, z: 0.4 },
      config: { dimensions: { x: 0.8, y: 0.8, z: 0.8 }, material: { color: 0x00b4d8 }, body: { mass: 5 } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'CrateHeavy',
      position: { x: -3, y: -1, z: 0.4 },
      config: { dimensions: { x: 0.8, y: 0.8, z: 0.8 }, material: { color: 0x0077b6 }, body: { mass: 50 } },
    },
    {
      class: 'Primitive',
      shape: 'SPHERE',
      name: 'BallLight',
      position: { x: -5, y: -5, z: 0.4 },
      config: { radius: 0.4, material: { color: 0xffb703 }, body: { mass: 0.3 } },
    },
    {
      class: 'Primitive',
      shape: 'SPHERE',
      name: 'BallHeavy',
      position: { x: -5, y: -3, z: 0.5 },
      config: { radius: 0.5, material: { color: 0xfb8500 }, body: { mass: 20 } },
    },

    {
      class: 'Player',
      name: 'Player',
      position: { x: 0, y: -7, z: 1.5 },
      config: {
        radius: 0.4,
        centersDistance: 1.0,
        walkSpeed: 4,
        runSpeedMultiplier: 1.8,
        jumpSpeed: 4,
        display: { model: { path: '/assets/characters/blockman' } },
      },
    },
  ],
};

// the engine's loading screen, up until the game runs (hidden after world.start() below)
const loading = LoadingScreen.show();
const world: ThreeGgWorld = new Gg3dWorld({
  visualScene: new ThreeSceneComponent(),
  physicsWorld: await createPhysicsWorld(),
});
world.init().then(async () => {
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;

  world.addLight({ type: 'AMBIENT', intensity: 0.6 });
  world.addLight(
    {
      type: 'DIRECTIONAL',
      color: 0xfffaf3,
      intensity: 1,
      castShadow: true,
      shadow: { mapSize: 2048, area: 15, far: 100 },
    },
    { x: 15, y: -15, z: 25 },
    Pnt3.O,
  );

  const levelGroup = await world.loader.loadLevel(level, 'MainLevel', { onProgress: p => loading.setProgress(p) });

  // the level's primitives and the player's model
  for (const item of levelGroup.children) {
    if ((item instanceof Entity3d || item instanceof CharacterController3dEntity) && item.object3D) {
      item.object3D.castShadow = true;
      item.object3D.receiveShadow = true;
    }
  }

  const cameraEntity = levelGroup.getChildEntityByName<Camera3dEntity<ThreeVisualTypeDocRepo>>('MainCamera');
  const renderer = world.addRenderer(cameraEntity.camera, canvas);

  const player = levelGroup.getChildEntityByName<CharacterController3dEntity>('Player');
  const controller = new PlayerCharacterController(world.keyboardInput, player, renderer, {
    mouseOptions: { canvas },
    ignoreMouseUnlessPointerLocked: true,
  });
  world.addEntity(controller);
  // on-screen stick and buttons on phones and tablets; does nothing on a desktop
  world.addEntity(new MobileControls());

  world.start();
  loading.hide();
});
