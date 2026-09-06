import {
  Camera3dEntity,
  CharacterController3dEntity,
  Entity3d,
  Gg3dWorld,
  Gg3dWorldTypeDocVPatch,
  GgStatic,
  GroupEntity,
  LevelJson,
  PlayerCharacterController,
} from '@gg-web-engine/core';
import { ThreeGgWorld, ThreeSceneComponent, ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { AmbientLight, DirectionalLight } from 'three';
import { AmmoWorldComponent } from '@gg-web-engine/ammo';

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
      class: 'Player',
      name: 'Player',
      position: { x: 9, y: 3, z: 9 },
      config: {
        radius: 0.4,
        centersDistance: 1.0,
        walkSpeed: 4,
        runSpeedMultiplier: 1.8,
        jumpSpeed: 5,
        display: { color: 0x3388ff },
      },
    },
  ],
};

const world: ThreeGgWorld = new Gg3dWorld({
  visualScene: new ThreeSceneComponent(),
  physicsWorld: new AmmoWorldComponent(),
});
world.init().then(async () => {
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;

  world.visualScene.nativeScene?.add(new AmbientLight(0xffffff, 0.6));
  const dirLight = new DirectionalLight(0xffffff, 1);
  dirLight.color.setHSL(0.1, 1, 0.95);
  dirLight.position.set(50, 50, 70);
  dirLight.lookAt(0, 0, 0);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  const d = 20;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  dirLight.shadow.camera.far = 3500;
  world.visualScene.nativeScene?.add(dirLight);

  const levelGroup = await world.loader.loadLevel(level);

  const cameraEntity = levelGroup.getChildEntityByName<Camera3dEntity<ThreeVisualTypeDocRepo>>('MainCamera');
  const renderer = world.addRenderer(cameraEntity.camera, canvas);

  const phScene = levelGroup.getChildEntityByName<GroupEntity>('PhScene');
  for (const item of phScene.children as Entity3d<Gg3dWorldTypeDocVPatch<ThreeVisualTypeDocRepo>>[]) {
    item.object3D?.nativeMesh.traverse(
      (obj) => {
        obj.castShadow = true;
        obj.receiveShadow = true;
      },
    );
  }

  const player = levelGroup.getChildEntityByName<CharacterController3dEntity>('Player');
  const controller = new PlayerCharacterController(world.keyboardInput, player, renderer, {
    mouseOptions: { canvas },
  });
  world.addEntity(controller);

  world.start();
});
