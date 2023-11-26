import { Entity2d, Gg2dWorld, GgDebuggerUI } from '@gg-web-engine/core';
import { interval } from 'rxjs';
import { PixiSceneComponent } from '@gg-web-engine/pixi';
import { Rapier2dWorldComponent } from '@gg-web-engine/rapier2d';

const world = new Gg2dWorld(
  new PixiSceneComponent(),
  new Rapier2dWorldComponent(),
);
GgDebuggerUI.instance.createUI();
world.init().then(async () => {
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;
  const renderer = world.addRenderer(canvas);

  const floor = world.addPrimitiveRigidBody({
    shape: { shape: 'SQUARE', dimensions: { x: 800, y: 100 } },
    body: { dynamic: false },
  });
  renderer.rendererSize$.subscribe((newSize) => {
    if (newSize) {
      floor.position = { x: newSize.x / 2, y: newSize.y - 75 };
    }
  });

  interval(500).subscribe(() => {
    let item: Entity2d;
    if (Math.random() >= 0.5) {
      item = world.addPrimitiveRigidBody({
        shape: { shape: 'SQUARE', dimensions: { x: 25, y: 25 } },
        body: { mass: 1 },
      });
    } else {
      item = world.addPrimitiveRigidBody({ shape: { shape: 'CIRCLE', radius: 13 }, body: { mass: 1 } });
    }
    item.position = { x: (renderer.rendererSize!.x || 800) / 2 + Math.random() * 100 - 50, y: 75 };
  });

  world.start();
});
