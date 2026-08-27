import {
  Camera3dEntity,
  Entity3d,
  Gg3dWorld,
  GgStatic,
  LevelJson,
  OrbitCameraController,
  Trigger3dEntity,
} from '@gg-web-engine/core';
import { ThreeSceneComponent, ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { Rapier3dWorldComponent } from '@gg-web-engine/rapier3d';
import { ShapeSpawner, ShapeSpawnerSettings } from './shape-spawner';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

const level: LevelJson = {
  entities: [
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'Floor',
      config: {
        dimensions: { x: 7, y: 7, z: 1 },
        body: { dynamic: false },
      },
    },
    {
      class: 'Trigger',
      name: 'KillFloor',
      position: { x: 0, y: 0, z: -15 },
      config: {
        dimensions: { x: 1000, y: 1000, z: 1 },
      },
    },
    {
      class: 'Camera',
      name: 'MainCamera',
      position: { x: 9, y: 12, z: 9 },
    },
    {
      class: 'ShapeSpawner',
      name: 'Spawner',
      config: {
        intervalSeconds: 0.5,
        area: { min: { x: -2.5, y: -2.5, z: 10 }, max: { x: 2.5, y: 2.5, z: 10 } },
      },
    },
  ],
};

const world = new Gg3dWorld({
  visualScene: new ThreeSceneComponent(),
  physicsWorld: new Rapier3dWorldComponent(),
});
world.init().then(async () => {
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;

  // Register the app-defined "ShapeSpawner" class before loading the level, so the loader can
  // dispatch its entry in `level` to it.
  world.loader.registerClass('ShapeSpawner', (w: Gg3dWorld, settings: ShapeSpawnerSettings) =>
    new ShapeSpawner(w, settings),
  );

  // Load the level. `loadLevel` resolves to a group entity holding every entity the level produced
  // as a child; named entities it produced (the camera and the trigger below) can be looked up by
  // the `name` they were given in `level` via `levelGroup.getChildEntityByName`.
  const levelGroup = await world.loader.loadLevel(level);

  // `Camera` entities from a level are a plain camera component wrapped in a `Camera3dEntity` -
  // not attached to any renderer/canvas (a level JSON has no notion of one), already parented
  // under the level's group entity. Attach it to a renderer explicitly.
  const cameraEntity = levelGroup.getChildEntityByName<Camera3dEntity<ThreeVisualTypeDocRepo>>('MainCamera');
  const renderer = world.addRenderer(cameraEntity.camera, canvas);
  const controller = new OrbitCameraController(renderer, { mouseOptions: { canvas } });
  world.addEntity(controller);


  const killZone = levelGroup.getChildEntityByName<Trigger3dEntity>('KillFloor');
  killZone.onEntityEntered.subscribe((entity: Entity3d) => {
    world.removeEntity(entity, true);
  });

  world.start();
});
