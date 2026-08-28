import { Gg2dWorld, GgStatic, LevelJson } from '@gg-web-engine/core';
import { PixiCameraComponent, PixiSceneComponent } from '@gg-web-engine/pixi';
import { Rapier2dWorldComponent } from '@gg-web-engine/rapier2d';
import { ShapeSpawner, ShapeSpawnerSettings } from './shape-spawner';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

const level: LevelJson = {
  entities: [
    {
      class: 'Primitive',
      shape: 'SQUARE',
      name: 'Floor',
      position: { x: 0, y: 300 },
      config: {
        dimensions: { x: 800, y: 100 },
        body: { dynamic: false },
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


  world.loader.registerClass('ShapeSpawner', (w: Gg2dWorld, settings: ShapeSpawnerSettings) =>
    new ShapeSpawner(w, settings),
  );

  await world.loader.loadLevel(level);

  world.start();
});
