import { Entity2d, Gg2dWorld, GgStatic } from '@gg-web-engine/core';
import { PixiCameraComponent, PixiSceneComponent } from '@gg-web-engine/pixi';
import { Rapier2dWorldComponent } from '@gg-web-engine/rapier2d';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

// The whole static part of this scene - the floor and a few decorative primitives - is hosted as
// a single JSON file and loaded by URL, instead of being built up with engine calls like the
// "primitives" example does. See ../assets/level-json/level2d.json
const LEVEL_URL = 'https://gg-web-demos.guraklgames.com/assets/level-json/level2d.json';

const world = new Gg2dWorld({
  visualScene: new PixiSceneComponent(),
  physicsWorld: new Rapier2dWorldComponent(),
});
world.init().then(async () => {
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;
  const renderer = world.addRenderer(new PixiCameraComponent(), canvas);

  renderer.rendererSize$.subscribe(newSize => {
    renderer.camera.zoom = Math.min(newSize.x / 850, newSize.y / 800, 1);
  });

  // Load the level (floor + a handful of static decorative Squares/Circles)
  await world.loader.loadLevelFromUrl(LEVEL_URL);

  // Beyond the level content, the world still behaves like any other `Gg2dWorld` - e.g. this
  // spawns new primitives imperatively, the same way the "primitives" example does.
  const spawnTimer = world.createClock(true);
  spawnTimer.tickRateLimit = 2;
  spawnTimer.tick$.subscribe(() => {
    let item: Entity2d;
    if (Math.random() >= 0.5) {
      item = world.addPrimitiveRigidBody({
        shape: { shape: 'SQUARE', dimensions: { x: 25, y: 25 } },
        body: { mass: 1 },
      });
    } else {
      item = world.addPrimitiveRigidBody({ shape: { shape: 'CIRCLE', radius: 13 }, body: { mass: 1 } });
    }
    item.position = { x: Math.random() * 100 - 50, y: -300 };
  });

  world.start();
});
