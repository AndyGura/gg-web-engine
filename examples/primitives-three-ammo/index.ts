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
import { AmmoWorldComponent } from '@gg-web-engine/ammo';
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
  physicsWorld: new AmmoWorldComponent(),
});
world.init().then(async () => {
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;

  world.loader.registerClass('ShapeSpawner', (w: Gg3dWorld, settings: ShapeSpawnerSettings) =>
    new ShapeSpawner(w, settings),
  );

  const levelGroup = await world.loader.loadLevel(level);

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
