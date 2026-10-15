import {
  CharacterController2dEntity,
  Gg2dWorld,
  GgStatic,
  LoadingScreen,
  PlayerCharacterController2d,
  Pnt2,
  Trigger2dEntity,
  TypedGg2dWorld,
} from '@gg-web-engine/core';
import { PixiGgWorld, PixiSceneComponent } from '@gg-web-engine/pixi';
import { Rapier2dGgWorld, Rapier2dWorldComponent } from '@gg-web-engine/rapier2d';
import { MobileControls } from '@gg-web-engine/mobile-controls';
import { Coin, registerCoin } from './coin';
import { level, SPAWN_POINT } from './level';

// Development builds only: press ` (backquote) for the engine's dev console. Production builds
// drop this branch, and the console with it.
if (import.meta.env.DEV) {
  GgStatic.instance.devConsoleEnabled = true;
}

// 1. The world: pixi.js draws it, Rapier simulates it. The loading screen covers the page until
//    the game runs.
const loading = LoadingScreen.show();
const world: TypedGg2dWorld<PixiGgWorld, Rapier2dGgWorld> = new Gg2dWorld({
  visualScene: new PixiSceneComponent(),
  physicsWorld: new Rapier2dWorldComponent(),
});
await world.init();

// 2. A camera rendering into the page's canvas, zoomed so about 700 px of the level fit vertically.
const canvas = document.getElementById('gg') as HTMLCanvasElement;
const renderer = world.addRenderer(world.visualScene.factory.createCamera(), canvas);
renderer.rendererSize$.subscribe(size => {
  if (size) renderer.camera.zoom = size.y / 700;
});

// 3. The level (src/level.ts). App-defined classes it uses must be registered first.
registerCoin(world);
const levelEntity = await world.loader.loadLevel(level, 'Level', { onProgress: p => loading.setProgress(p) });

// 4. The player: the level built the character; attach keyboard control and a following camera.
const player = levelEntity.getChildEntityByName<CharacterController2dEntity>('Player');
world.addEntity(new PlayerCharacterController2d(world.keyboardInput, player, renderer, { lookAheadDistance: 120 }));
world.addEntity(new MobileControls()); // on-screen buttons on touch devices; nothing on desktop

// 5. Falling into the kill zone puts the player back at the start.
const killZone = levelEntity.getChildEntityByName<Trigger2dEntity>('KillZone');
killZone.onEntityEntered.subscribe(entity => {
  if (entity === player) {
    player.position = SPAWN_POINT;
    player.fallVelocity = Pnt2.O;
    player.airHorizontalVelocity = Pnt2.O;
  }
});

// 6. Score: the level JSON already removes a touched coin; here we count it.
let score = 0;
const scoreText = document.getElementById('score')!;
for (const coin of levelEntity.children.filter(child => child instanceof Coin)) {
  coin.onCollected.subscribe(() => (scoreText.textContent = String(++score)));
}

// 7. Add your gameplay here: enemies, more levels, a win condition, sounds...
//    `world.loader.registerClass` adds your own level JSON classes (see coin.ts), and
//    `createInlineTickController(world).subscribe(...)` runs code every frame.

world.start();
loading.hide();
