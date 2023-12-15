import { Entity3d, Gg3dWorld, GgStatic, OrbitCameraController, Qtrn, Trigger3dEntity } from '@gg-web-engine/core';
import { interval } from 'rxjs';
import { ThreeSceneComponent } from '@gg-web-engine/three';
import { AmbientLight, DirectionalLight } from 'three';
import { Rapier3dWorldComponent } from '@gg-web-engine/rapier3d';

const world = new Gg3dWorld(
  new ThreeSceneComponent(),
  new Rapier3dWorldComponent(),
);
world.init().then(async () => {
  GgStatic.instance.showStats = true;
  // GgStatic.instance.devConsoleEnabled = true;
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;
  const renderer = world.addRenderer(
    world.visualScene.factory.createPerspectiveCamera(),
    canvas,
  );
  renderer.position = { x: 20, y: -16, z: 9 };

  const controller = new OrbitCameraController(renderer, { mouseOptions: { canvas } });
  world.addEntity(controller);

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
  world.visualScene.nativeScene!.add(dirLight);

  const ambient = new AmbientLight(0xffffff, 0.3);
  world.visualScene.nativeScene!.add(ambient);

  const cgs = [
    0xff0000,
    0x00ff00,
    0x0000ff,
    0xffff00,
    0xff00ff,
  ].map(c => ([c, world.physicsWorld.registerCollisionGroup()]));

  for (let i = 0; i < cgs.length; i++) {
    const [color, collisionGroup] = cgs[i];
    world.addPrimitiveRigidBody({
      shape: { shape: 'BOX', dimensions: { x: 7, y: 7, z: 0.5 } },
      // collision groups can be set immediately when creating entity
      body: { dynamic: false, ownCollisionGroups: [collisionGroup], interactWithCollisionGroups: [collisionGroup] },
    },
      { x: 0, y: 0, z: -(i + 1 - cgs.length / 2) * 5 },
      Qtrn.fromEuler({ x: Math.PI / 4, y: 0, z: 2 * i * Math.PI / cgs.length }), {
      color,
      shading: 'phong',
      castShadow: true,
      receiveShadow: true,
    });
  }

  const destroyTrigger = new Trigger3dEntity(
    world.physicsWorld.factory.createTrigger({
      shape: 'BOX',
      dimensions: { x: 1000, y: 1000, z: 1 },
    }),
  );
  destroyTrigger.position = { x: 0, y: 0, z: -50 };
  destroyTrigger.onEntityEntered.subscribe((entity: Entity3d) => {
    world.removeEntity(entity, true);
  });
  world.addEntity(destroyTrigger);

  interval(200).subscribe(() => {
    const [color, collisionGroup] = cgs[Math.floor(Math.random() * cgs.length)];
    let item: Entity3d = world.addPrimitiveRigidBody(
      {
        shape: { shape: 'SPHERE', radius: 1 },
        body: { mass: 1, restitution: 1.5 },
      },
      { x: 0, y: 0, z: cgs.length * 2.5 + 10 },
      Qtrn.O,
      { color, shading: 'phong', castShadow: true, receiveShadow: true },
    );
    item.objectBody.linearVelocity = { x: 0, y: 0, z: -20 };
    // also collision groups can be set later
    item.objectBody.ownCollisionGroups = item.objectBody.interactWithCollisionGroups = [collisionGroup];
  });
  world.start();
});
