import { Entity3d, Gg3dWorld, GgStatic, OrbitCameraController, Trigger3dEntity } from '@gg-web-engine/core';
import { interval } from 'rxjs';
import { ThreeSceneComponent } from '@gg-web-engine/three';
import { Rapier3dWorldComponent } from '@gg-web-engine/rapier3d';

const world = new Gg3dWorld(
  new ThreeSceneComponent(),
  new Rapier3dWorldComponent(),
);
world.init().then(async () => {
  GgStatic.instance.showStats = true;
  // GgStatic.instance.devConsoleEnabled = true;
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;
  const renderer = world.addRenderer(world.visualScene.factory.createPerspectiveCamera(), canvas);
  renderer.position = { x: 9, y: 12, z: 9 };

  const controller = new OrbitCameraController(renderer, { mouseOptions: { canvas } });
  world.addEntity(controller);

  world.addPrimitiveRigidBody({
    shape: { shape: 'BOX', dimensions: { x: 7, y: 7, z: 1 } },
    body: { dynamic: false },
  });

  const destroyTrigger = new Trigger3dEntity(
    world.physicsWorld.factory.createTrigger({
      shape: 'BOX',
      dimensions: { x: 1000, y: 1000, z: 1 },
    }),
  );
  destroyTrigger.position = { x: 0, y: 0, z: -15 };
  destroyTrigger.onEntityEntered.subscribe((entity: Entity3d) => {
    world.removeEntity(entity, true);
  });
  world.addEntity(destroyTrigger);

  interval(500).subscribe(() => {
    let item: Entity3d;
    let r = Math.random();
    if (r < 0.2) {
      item = world.addPrimitiveRigidBody({
        shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } },
        body: { mass: 1 },
      });
    } else if (r < 0.4) {
      item = world.addPrimitiveRigidBody({
        shape: { shape: 'CAPSULE', radius: 0.5, centersDistance: 1 },
        body: { mass: 1 },
      });
    } else if (r < 0.6) {
      item = world.addPrimitiveRigidBody({
        shape: { shape: 'CYLINDER', radius: 0.5, height: 1 },
        body: { mass: 1 },
      });
    } else if (r < 0.8) {
      item = world.addPrimitiveRigidBody({
        shape: { shape: 'CONE', radius: 0.5, height: 1 },
        body: { mass: 1 },
      });
    } else {
      item = world.addPrimitiveRigidBody({
        shape: { shape: 'SPHERE', radius: 0.5 },
        body: { mass: 1 },
      });
    }
    item.position = {
      x: Math.random() * 5 - 2.5,
      y: Math.random() * 5 - 2.5,
      z: 10,
    };
  });
  world.start();
});
