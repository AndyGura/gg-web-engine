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

// A 9 x 6 m room (the 2D world measures in meters, y down): floor near the bottom, ceiling near the
// top, walls left/right, three platforms at increasing height that need a running jump to reach
// (the gaps are well beyond `maxStepHeight`).
const ROOM_WIDTH = 9;
const ROOM_HEIGHT = 6;
const WALL = 0.4;

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
      position: { x: -2.6, y: 1.4 },
      config: { dimensions: { x: 1.8, y: 0.24 }, material: { color: 0x9a8c98 }, body: { bodyType: 'static' } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'PlatformMid',
      position: { x: 0.2, y: 0 },
      config: { dimensions: { x: 1.6, y: 0.24 }, material: { color: 0x9a8c98 }, body: { bodyType: 'static' } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'PlatformHigh',
      position: { x: 2.6, y: -1.4 },
      config: { dimensions: { x: 1.6, y: 0.24 }, material: { color: 0x9a8c98 }, body: { bodyType: 'static' } },
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
    // the whole room (plus a 1 m margin) stays in view
    const ppm = world.visualScene.pixelsPerMeter;
    renderer.camera.zoom = Math.min(newSize.x / ((ROOM_WIDTH + 1) * ppm), newSize.y / ((ROOM_HEIGHT + 1) * ppm), 1);
  });

  await world.loader.loadLevel(level, 'MainLevel', { onProgress: p => loading.setProgress(p) });
  // a snappier fall than the default 9.82 m/s² - the character and everything else in this world
  // follows it, in m/s²
  world.physicsWorld!.gravity = { x: 0, y: 20 };

  // A pixel-art atlas (idle/walk/run/jump/crouch rows on a uniform grid - see
  // ../assets/characters/generate-character-atlas.py) sliced into named animation clips.
  // 'nearest' keeps the pixel-art look crisp when scaled up; a 48x72 px frame is 0.48x0.72 m, so at
  // scale 1.2 the sprite stands about 0.86 m tall - roughly the capsule's 0.4 + 0.4 + 0.2 m
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
    { radius: 0.2, centersDistance: 0.4, up: Pnt2.nY, maxStepHeight: 0.12 },
    { position: { x: -ROOM_WIDTH / 2 + 1, y: ROOM_HEIGHT / 2 - WALL - 0.4 } },
  );
  const player = new CharacterController2dEntity(
    {
      radius: 0.2,
      centersDistance: 0.4,
      walkSpeed: 2.6, // m/s
      runSpeedMultiplier: 1.8,
      crouchSpeedMultiplier: 0.5,
      jumpSpeed: 7.8, // m/s: about 1.5 m up under this world's 20 m/s² gravity
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
      size: 0.2, // meters, like every particle size and speed below
      tint: 0xc9c2b8,
      drag: 4,
      frames: ParticleFrames.grid(4, 1),
      frameSequence: [0, 1, 2, 3], // spread evenly over each puff's life
      opacityOverLife: [0.8, 0],
    },
  );
  // the character's feet, in its own frame: the capsule is centered on `position`, y points down
  const FEET = { x: 0, y: 0.2 + 0.2 };
  let wasGrounded = true;
  let fallSpeed = 0;
  let runDustTimer = 0;
  // after the character has moved this tick (its own tick is before the physics step)
  createInlineTickController(world, TickOrder.RENDERING - 20, 'DustSpawner').subscribe(([, delta]) => {
    const feet = Pnt2.add(player.position, FEET);
    if (player.isGrounded && !wasGrounded && fallSpeed > 3) {
      // landed: puffs spreading out to both sides, more of them after a higher fall (one per m/s)
      dust.emit(Math.min(12, Math.round(fallSpeed)), (p, ctx) => {
        p.position = feet;
        p.velocity = { x: ctx.range(-1.8, 1.8), y: ctx.range(-0.4, 0) };
      });
    }
    if (player.isGrounded && player.isRunning && player.moveDirection !== 0) {
      runDustTimer += delta;
      if (runDustTimer >= 90) {
        runDustTimer = 0;
        dust.emit(1, (p, ctx) => {
          p.position = { x: feet.x - player.facing * 0.12, y: feet.y + ctx.range(-0.04, 0) };
          p.velocity = { x: -player.facing * ctx.range(0.2, 0.6), y: ctx.range(-0.3, -0.1) };
          p.size = { x: 0.14, y: 0.14 };
        });
      }
    } else {
      runDustTimer = 90;
    }
    wasGrounded = player.isGrounded;
    fallSpeed = player.actualVelocity.y;
  });
  world.addEntity(new PlayerCharacterController2d(world.keyboardInput, player, renderer, { lookAheadDistance: 1.2 }));
  // on-screen controls on phones and tablets; does nothing on a desktop
  world.addEntity(new MobileControls());

  world.start();
  loading.hide();
});
