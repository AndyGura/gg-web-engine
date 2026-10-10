import {
  CharacterAnimation2dController,
  CharacterController2dEntity,
  createInlineTickController,
  Gg2dWorld,
  GgStatic,
  LevelJson,
  LoadingScreen,
  ParticleFrames,
  Pnt2,
  PlayerCharacterController2d,
  TickOrder,
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

// the engine's loading screen, up until the game runs (hidden after world.start() below)
const loading = LoadingScreen.show();
const world: PixiGgWorld = new Gg2dWorld({
  visualScene: new PixiSceneComponent(),
  physicsWorld: await createPhysicsWorld(),
});

world.init().then(async () => {
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;
  const renderer = world.addRenderer(world.visualScene.factory.createCamera(), canvas);
  renderer.rendererSize$.subscribe(newSize => {
    if (!newSize) return;
    renderer.camera.zoom = Math.min(newSize.x / (ROOM_WIDTH + 100), newSize.y / (ROOM_HEIGHT + 100), 1);
  });

  await world.loader.loadLevel(level, 'MainLevel', { onProgress: p => loading.setProgress(p) });

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

  // Dust puffs: a particle system fed by the character's own state every tick - a burst when
  // landing from a fall, a trail of small puffs behind the feet while running. Each puff plays a
  // four-frame "expanding ring" animation from a sprite atlas drawn on a canvas right here (a
  // uniform grid, sliced with ParticleFrames.grid), the same way an atlas image file would be used.
  const dustCanvas = document.createElement('canvas');
  dustCanvas.width = 128;
  dustCanvas.height = 32;
  const dustContext = dustCanvas.getContext('2d')!;
  for (let frame = 0; frame < 4; frame++) {
    const radius = 6 + frame * 3;
    dustContext.beginPath();
    dustContext.arc(frame * 32 + 16, 16, radius, 0, Math.PI * 2);
    dustContext.fillStyle = `rgba(255, 255, 255, ${0.9 - frame * 0.2})`;
    dustContext.fill();
  }
  const dust = world.addParticleSystem(
    { capacity: 100, texture: world.visualScene.factory.createTextureFromCanvas(dustCanvas), zIndex: 1 },
    {
      lifetime: 0.4,
      size: 20,
      tint: 0xc9c2b8,
      drag: 4,
      frames: ParticleFrames.grid(4, 1),
      frameSequence: [0, 1, 2, 3], // spread evenly over each puff's life
      opacityOverLife: [0.8, 0],
    },
  );
  // the character's feet, in its own frame: the capsule is centered on `position`, y points down
  const FEET = { x: 0, y: 20 + 20 };
  let wasGrounded = true;
  let fallSpeed = 0;
  let runDustTimer = 0;
  // after the character has moved this tick (its own tick is before the physics step)
  createInlineTickController(world, TickOrder.RENDERING - 20, 'DustSpawner').subscribe(([, delta]) => {
    const feet = Pnt2.add(player.position, FEET);
    if (player.isGrounded && !wasGrounded && fallSpeed > 300) {
      // landed: puffs spreading out to both sides, more of them after a higher fall
      dust.emit(Math.min(12, Math.round(fallSpeed / 100)), (p, ctx) => {
        p.position = feet;
        p.velocity = { x: ctx.range(-180, 180), y: ctx.range(-40, 0) };
      });
    }
    if (player.isGrounded && player.isRunning && player.moveDirection !== 0) {
      runDustTimer += delta;
      if (runDustTimer >= 90) {
        runDustTimer = 0;
        dust.emit(1, (p, ctx) => {
          p.position = { x: feet.x - player.facing * 12, y: feet.y + ctx.range(-4, 0) };
          p.velocity = { x: -player.facing * ctx.range(20, 60), y: ctx.range(-30, -10) };
          p.size = { x: 14, y: 14 };
        });
      }
    } else {
      runDustTimer = 90;
    }
    wasGrounded = player.isGrounded;
    fallSpeed = player.actualVelocity.y;
  });
  world.addEntity(new PlayerCharacterController2d(world.keyboardInput, player, renderer, { lookAheadDistance: 120 }));
  // on-screen controls on phones and tablets; does nothing on a desktop
  world.addEntity(new MobileControls());

  world.start();
  loading.hide();
});
