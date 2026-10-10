import { Gg2dWorld, GgStatic, LevelJson, LoadingScreen } from '@gg-web-engine/core';
import { PixiGgWorld, PixiSceneComponent } from '@gg-web-engine/pixi';
import { createPhysicsWorld } from './backends';
import { ShapeSpawner, ShapeSpawnerSettings } from './shape-spawner';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

const level: LevelJson = {
  entities: [
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'Floor',
      position: { x: 0, y: 300 },
      config: {
        dimensions: { x: 800, y: 100 },
        body: { bodyType: 'static' },
      },
    },
    {
      class: 'ShapeSpawner',
      name: 'Spawner',
      config: {
        intervalSeconds: 0.5,
        area: { min: { x: -50, y: -300 }, max: { x: 50, y: -300 } },
      },
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
    renderer.camera.zoom = Math.min(newSize.x / 850, newSize.y / 800, 1);
  });

  world.loader.registerClass(
    'ShapeSpawner',
    (w: Gg2dWorld, settings: ShapeSpawnerSettings) => new ShapeSpawner(w, settings),
  );

  await world.loader.loadLevel(level, 'MainLevel', { onProgress: p => loading.setProgress(p) });
  world.start();
  loading.hide();
});
