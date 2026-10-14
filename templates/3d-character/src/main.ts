import {
  Camera3dEntity,
  CharacterController3dEntity,
  createInlineTickController,
  Gg3dWorld,
  GgStatic,
  LoadingScreen,
  PlayerCharacterController,
  Trigger3dEntity,
  TypedGg3dWorld,
} from '@gg-web-engine/core';
import { ThreeGgWorld, ThreeSceneComponent, ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { Rapier3dGgWorld, Rapier3dWorldComponent } from '@gg-web-engine/rapier3d';
import { level } from './level';

// Development builds only: press ` (backquote) for the engine's dev console. Vite drops this
// branch from `npm run build`, so players never get it.
if (import.meta.env.DEV) {
  GgStatic.instance.devConsoleEnabled = true;
}

// 1. Cover the page with the engine's loading screen until the game is ready.
const loading = LoadingScreen.show();

// 2. Create the world: three.js draws it, Rapier simulates it.
const world: TypedGg3dWorld<ThreeGgWorld, Rapier3dGgWorld> = new Gg3dWorld({
  visualScene: new ThreeSceneComponent(),
  physicsWorld: new Rapier3dWorldComponent(),
});
await world.init();

// 3. Load the level described in level.ts.
const levelEntity = await world.loader.loadLevel(level, 'MainLevel', {
  onProgress: p => loading.setProgress(p),
});

// 4. Render the level's camera into the canvas.
const canvas = document.getElementById('gg') as HTMLCanvasElement;
const camera = levelEntity.getChildEntityByName<Camera3dEntity<ThreeVisualTypeDocRepo>>('MainCamera');
const renderer = world.addRenderer(camera.camera, canvas);

// 5. Drive the level's player with keyboard + mouse and a third-person camera.
//    Click the canvas to lock the pointer for mouse look; Esc releases it.
const player = levelEntity.getChildEntityByName<CharacterController3dEntity>('Player');
const controller = new PlayerCharacterController(world.keyboardInput, player, renderer, {
  viewMode: 'third-person',
  thirdPersonDistance: 5,
  mouseOptions: { canvas },
  ignoreMouseUnlessPointerLocked: true,
});
world.addEntity(controller);

// 6. Start the clock and remove the loading screen.
world.start();
loading.hide();

// ---------------------------------------------------------------------------------------------
// Add your gameplay here.
// ---------------------------------------------------------------------------------------------

const spawnPoint = player.position;

// A trigger from the level: fires when something enters its volume.
const goal = levelEntity.getChildEntityByName<Trigger3dEntity>('Goal');
goal.onEntityEntered.subscribe(entity => {
  if (entity === player) {
    console.log('Player reached the goal!');
  }
});

// A per-frame hook: runs every tick with the elapsed time and the delta since the last tick (ms).
createInlineTickController(world).subscribe(([_elapsed, _delta]) => {
  // e.g. put the player back if they somehow leave the arena
  if (player.position.z < -10) {
    player.position = spawnPoint;
  }
});
