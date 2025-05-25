import { Entity2d, Gg2dWorld, GgStatic } from '@gg-web-engine/core';
import { PixiCameraComponent, PixiSceneComponent } from '@gg-web-engine/pixi';
import { Rapier2dWorldComponent } from '@gg-web-engine/rapier2d';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

const world = new Gg2dWorld({
  visualScene: new PixiSceneComponent(),
  physicsWorld: new Rapier2dWorldComponent(),
});
world.init().then(async () => {
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;
  const renderer = world.addRenderer(new PixiCameraComponent(), canvas);

  renderer.rendererSize$.subscribe((newSize) => {
    renderer.camera.zoom = Math.min(
      newSize.x / 850,
      newSize.y / 800,
      1,
    );
  });

  world.addPrimitiveRigidBody({
    shape: { shape: 'SQUARE', dimensions: { x: 800, y: 100 } },
    body: { dynamic: false },
  }, { x: 0, y: 300 });

  const spawnTimer = world.createClock(true);
  spawnTimer.tickRateLimit = 2;
  spawnTimer.tick$.subscribe(() => {
    let item: Entity2d;
    if (Math.random() >= 0.5) {
      item = world.addPrimitiveRigidBody({
        shape: { shape: 'SQUARE', dimensions: { x: 25, y: 25 } },
        body: { mass: 1 },
      });
    } else {
      item = world.addPrimitiveRigidBody({ shape: { shape: 'CIRCLE', radius: 13 }, body: { mass: 1 } });
    }
    item.position = { x: Math.random() * 100 - 50, y: -300 };
  });

  world.start();
});
