import { Gg3dWorld, GgStatic, OrbitCameraController } from '@gg-web-engine/core';
import { interval } from 'rxjs';
import { ThreeSceneComponent, ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { AmbientLight, DirectionalLight } from 'three';
import { AmmoPhysicsTypeDocRepo, AmmoWorldComponent } from '@gg-web-engine/ammo';

const world = new Gg3dWorld<
  ThreeVisualTypeDocRepo,
  AmmoPhysicsTypeDocRepo,
  ThreeSceneComponent,
  AmmoWorldComponent
>(
  new ThreeSceneComponent(),
  new AmmoWorldComponent(),
);
world.init().then(async () => {
  GgStatic.instance.showStats = true;
  // GgStatic.instance.devConsoleEnabled = true;
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;
  const renderer = world.addRenderer(world.visualScene.factory.createPerspectiveCamera(), canvas);
  renderer.position = { x: 9, y: 12, z: 9 };

  const controller = new OrbitCameraController(renderer, { mouseOptions: { canvas } });
  world.addEntity(controller);

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

  const { entities } = await world.loader.loadGgGlb(
    'https://gg-web-demos.guraklgames.com/assets/model-loader/ph_scene',
  );
  for (const item of entities) {
    if (item.object3D) {
      item.object3D.nativeMesh.traverse(
        (obj) => {
          obj.castShadow = true;
          obj.receiveShadow = true;
        },
      );
    }
    world.addEntity(item);
  }

  interval(500).subscribe(async () => {
    const itemTypeRand = Math.random();
    let glbId = '';
    if (itemTypeRand < 1 / 7) {
      glbId = 'ball';
    } else if (itemTypeRand < 2 / 7) {
      glbId = 'dice';
    } else if (itemTypeRand < 3 / 7) {
      glbId = 'christmas_tree';
    } else if (itemTypeRand < 4 / 7) {
      glbId = 'battery';
    } else if (itemTypeRand < 5 / 7) {
      glbId = 'capsule';
    } else if (itemTypeRand < 6 / 7) {
      glbId = 'convex_hull';
    } else {
      glbId = 'compound';
    }
    const { entities } = await world.loader.loadGgGlb(
      'https://gg-web-demos.guraklgames.com/assets/model-loader/' + glbId,
      {
        position: {
          x: Math.random() * 5 - 2.5,
          y: Math.random() * 5 - 2.5,
          z: 10,
        },
      },
    );
    const item = entities[0];
    item.object3D.nativeMesh.traverse(
      (obj) => {
        obj.castShadow = true;
        obj.receiveShadow = true;
      },
    );
    world.addEntity(item);
    setTimeout(() => {
      world.removeEntity(item, true);
    }, 30000);
  });

  world.start();
});
