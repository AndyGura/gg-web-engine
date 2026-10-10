import {
  Entity3d,
  Gg3dWorld,
  GgStatic,
  LoadingScreen,
  OrbitCameraController,
  Pnt3,
  Qtrn,
  Trigger3dEntity,
} from '@gg-web-engine/core';
import { ThreeSceneComponent, ThreeGgWorld, ThreeTypeDoc } from '@gg-web-engine/three';
import { createPhysicsWorld } from './backends';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

// the engine's loading screen, up until the game runs (hidden after world.start() below)
const loading = LoadingScreen.show();
const world: ThreeGgWorld = new Gg3dWorld({
  visualScene: new ThreeSceneComponent(),
  physicsWorld: await createPhysicsWorld(),
});
world.init().then(async () => {
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;
  const renderer = world.addRenderer(world.visualScene.factory.createPerspectiveCamera(), canvas);
  renderer.position = { x: 20, y: -16, z: 9 };

  const controller = new OrbitCameraController(renderer, { mouseOptions: { canvas } });
  world.addEntity(controller);

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
  world.addLight({ type: 'AMBIENT', intensity: 0.3 });

  const cgs = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff].map(c => [
    c,
    world.physicsWorld!.registerCollisionGroup(),
  ]);

  for (let i = 0; i < cgs.length; i++) {
    const [color, collisionGroup] = cgs[i];
    world.addPrimitiveRigidBody(
      {
        shape: { shape: 'BOX', dimensions: { x: 7, y: 7, z: 0.5 } },
        // collision groups can be set immediately when creating entity
        body: {
          bodyType: 'static',
          ownCollisionGroups: [collisionGroup],
          interactWithCollisionGroups: [collisionGroup],
        },
      },
      { x: 0, y: 0, z: -(i + 1 - cgs.length / 2) * 5 },
      Qtrn.fromEuler({ x: Math.PI / 4, y: 0, z: (2 * i * Math.PI) / cgs.length }),
      {
        color,
        shading: 'phong',
        castShadow: true,
        receiveShadow: true,
      },
    );
  }

  const destroyTrigger = new Trigger3dEntity(
    world.physicsWorld!.factory.createTrigger({
      shape: 'BOX',
      dimensions: { x: 1000, y: 1000, z: 1 },
    }),
  );
  destroyTrigger.position = { x: 0, y: 0, z: -50 };
  destroyTrigger.onEntityEntered.subscribe(entity => {
    world.removeEntity(entity, true);
  });
  world.addEntity(destroyTrigger);

  const spawnTimer = world.createClock(true);
  spawnTimer.tickRateLimit = 5;
  spawnTimer.tick$.subscribe(() => {
    const [color, collisionGroup] = cgs[Math.floor(Math.random() * cgs.length)];
    let item: Entity3d<ThreeTypeDoc> = world.addPrimitiveRigidBody(
      {
        shape: { shape: 'SPHERE', radius: 1 },
        body: { mass: 1, restitution: 1.5 },
      },
      { x: 0, y: 0, z: cgs.length * 2.5 + 10 },
      Qtrn.O,
      { color, shading: 'phong', castShadow: true, receiveShadow: true },
    );
    item.objectBody!.linearVelocity = { x: 0, y: 0, z: -20 };
    // also collision groups can be set later
    item.objectBody!.ownCollisionGroups = item.objectBody!.interactWithCollisionGroups = [collisionGroup];
  });
  world.start();
  loading.hide();
});
