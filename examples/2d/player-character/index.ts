import {
  CharacterAnimation2dController,
  CharacterController2dEntity,
  Gg2dWorld,
  GgStatic,
  LevelJson,
  Pnt2,
  PlayerCharacterController2d,
} from '@gg-web-engine/core';
import { MobileControls } from '@gg-web-engine/mobile-controls';
import { PixiGgWorld, PixiSceneComponent } from '@gg-web-engine/pixi';
import { createPhysicsWorld } from './backends';

const characterAtlasUrl = '/assets/characters/character-atlas.png';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

// Pixel-scale room: floor near the bottom, ceiling near the top, walls left/right, three platforms
// at increasing height that need a running jump to reach (the gaps are well beyond `maxStepHeight`).
const ROOM_WIDTH = 900;
const ROOM_HEIGHT = 600;
const WALL = 40;

const level: LevelJson = {
  entities: [
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'Floor',
      position: { x: 0, y: ROOM_HEIGHT / 2 - WALL / 2 },
      config: { dimensions: { x: ROOM_WIDTH, y: WALL }, material: { color: 0x4a4e69 }, body: { bodyType: 'static' } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'Ceiling',
      position: { x: 0, y: -(ROOM_HEIGHT / 2 - WALL / 2) },
      config: { dimensions: { x: ROOM_WIDTH, y: WALL }, material: { color: 0x22223b }, body: { bodyType: 'static' } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'WallLeft',
      position: { x: -(ROOM_WIDTH / 2 - WALL / 2), y: 0 },
      config: { dimensions: { x: WALL, y: ROOM_HEIGHT }, material: { color: 0x22223b }, body: { bodyType: 'static' } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'WallRight',
      position: { x: ROOM_WIDTH / 2 - WALL / 2, y: 0 },
      config: { dimensions: { x: WALL, y: ROOM_HEIGHT }, material: { color: 0x22223b }, body: { bodyType: 'static' } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'PlatformLow',
      position: { x: -260, y: 140 },
      config: { dimensions: { x: 180, y: 24 }, material: { color: 0x9a8c98 }, body: { bodyType: 'static' } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'PlatformMid',
      position: { x: 20, y: 0 },
      config: { dimensions: { x: 160, y: 24 }, material: { color: 0x9a8c98 }, body: { bodyType: 'static' } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'PlatformHigh',
      position: { x: 260, y: -140 },
      config: { dimensions: { x: 160, y: 24 }, material: { color: 0x9a8c98 }, body: { bodyType: 'static' } },
    },
  ],
};

const world: PixiGgWorld = new Gg2dWorld({
  visualScene: new PixiSceneComponent(),
  physicsWorld: await createPhysicsWorld(),
  loadingScreen: true, // covers the page until world.start()
});

world.init().then(async () => {
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;
  const renderer = world.addRenderer(world.visualScene.factory.createCamera(), canvas);
  renderer.rendererSize$.subscribe(newSize => {
    if (!newSize) return;
    renderer.camera.zoom = Math.min(newSize.x / (ROOM_WIDTH + 100), newSize.y / (ROOM_HEIGHT + 100), 1);
  });

  await world.loader.loadLevel(level, 'MainLevel');

  // A pixel-art atlas (idle/walk/run/jump/crouch rows on a uniform grid - see
  // ../assets/characters/generate-character-atlas.py) sliced into named animation clips.
  // 'nearest' keeps the pixel-art look crisp when scaled up
  const atlasTexture = await world.visualScene.factory.loadTexture(characterAtlasUrl, { filter: 'nearest' });
  const sprite = world.visualScene.factory.createAnimatedSprite(atlasTexture, {
    frameWidth: 48,
    frameHeight: 72,
    clips: {
      idle: { row: 0, frameCount: 4, fps: 6 },
      walk: { row: 1, frameCount: 6, fps: 10 },
      run: { row: 2, frameCount: 6, fps: 14 },
      jump: { row: 3, frameCount: 6, fps: 10 },
      crouch: { row: 4, frameCount: 4, fps: 6 },
    },
  });
  sprite.scale = { x: 1.2, y: 1.2 };

  const characterController = world.physicsWorld!.factory.createCharacterController(
    { radius: 20, centersDistance: 40, up: Pnt2.nY, maxStepHeight: 12 },
    { position: { x: -ROOM_WIDTH / 2 + 100, y: ROOM_HEIGHT / 2 - WALL - 40 } },
  );
  const player = new CharacterController2dEntity(
    {
      radius: 20,
      centersDistance: 40,
      walkSpeed: 260,
      runSpeedMultiplier: 1.8,
      crouchSpeedMultiplier: 0.5,
      jumpSpeed: 780,
      // this world's own gravity default (9.82) is tuned for a meter-scale 3D world, not this
      // pixel-scale room - override with a pixel-scale-appropriate fall acceleration instead of
      // touching `world.physicsWorld.gravity` (which nothing else in this scene depends on).
      gravity: 2000,
      airControlFactor: 0.4,
    },
    sprite,
    characterController,
  );
  world.addEntity(player);
  world.addEntity(new CharacterAnimation2dController(player));
  world.addEntity(new PlayerCharacterController2d(world.keyboardInput, player, renderer, { lookAheadDistance: 120 }));
  // on-screen controls on phones and tablets; does nothing on a desktop
  world.addEntity(new MobileControls());

  world.start();
});
