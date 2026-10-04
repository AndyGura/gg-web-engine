import {
  Camera3dEntity,
  Entity3d,
  Gg3dWorld,
  Gg3dWorldTypeDocVPatch,
  GgStatic,
  GroupEntity,
  LevelJson,
  OrbitCameraController,
  Pnt3,
} from '@gg-web-engine/core';
import { ThreeGgWorld, ThreeSceneComponent, ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { Rapier3dWorldComponent } from '@gg-web-engine/rapier3d';
import { GlbSpawner, GlbSpawnerSettings } from './glb-spawner';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

const level: LevelJson = {
  entities: [
    {
      class: 'Camera',
      name: 'MainCamera',
      position: { x: 9, y: 12, z: 9 },
    },
    {
      class: 'Glb',
      name: 'PhScene',
      config: { path: 'https://gg-web-demos.guraklgames.com/assets/model-loader/ph_scene' },
    },
    {
      class: 'GlbSpawner',
      name: 'Spawner',
      config: {
        intervalSeconds: 0.5,
        lifetimeSeconds: 30,
        baseUrl: 'https://gg-web-demos.guraklgames.com/assets/model-loader',
        glbIds: ['ball', 'dice', 'christmas_tree', 'battery', 'capsule', 'convex_hull', 'compound'],
        area: { min: { x: -2.5, y: -2.5, z: 10 }, max: { x: 2.5, y: 2.5, z: 10 } },
      },
    },
  ],
};

const world: ThreeGgWorld = new Gg3dWorld({
  visualScene: new ThreeSceneComponent(),
  physicsWorld: new Rapier3dWorldComponent(),
});
world.init().then(async () => {
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;

  world.addLight({ type: 'AMBIENT', intensity: 0.6 });
  world.addLight(
    {
      type: 'DIRECTIONAL',
      color: 0xfffaf3,
      intensity: 1,
      castShadow: true,
      shadow: { mapSize: 2048, area: 20, far: 3500 },
    },
    { x: 50, y: 50, z: 70 },
    Pnt3.O,
  );

  world.loader.registerClass(
    'GlbSpawner',
    (w: Gg3dWorld<Gg3dWorldTypeDocVPatch<ThreeVisualTypeDocRepo>>, settings: GlbSpawnerSettings) =>
      new GlbSpawner(w, settings),
  );

  const levelGroup = await world.loader.loadLevel(level, 'MainLevel');

  const cameraEntity = levelGroup.getChildEntityByName<Camera3dEntity<ThreeVisualTypeDocRepo>>('MainCamera');
  const renderer = world.addRenderer(cameraEntity.camera, canvas);
  const controller = new OrbitCameraController(renderer, { mouseOptions: { canvas } });
  world.addEntity(controller);

  const phScene = levelGroup.getChildEntityByName<GroupEntity>('PhScene');
  for (const item of phScene.children as Entity3d<Gg3dWorldTypeDocVPatch<ThreeVisualTypeDocRepo>>[]) {
    item.object3D?.nativeMesh.traverse(
      (obj) => {
        obj.castShadow = true;
        obj.receiveShadow = true;
      },
    );
  }

  world.start();
});
