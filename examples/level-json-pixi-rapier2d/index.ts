import { Entity2d, Gg2dWorld, GgStatic, Point2 } from '@gg-web-engine/core';
import { PixiCameraComponent, PixiSceneComponent } from '@gg-web-engine/pixi';
import { Rapier2dWorldComponent } from '@gg-web-engine/rapier2d';
import level from './level.json';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

// The whole static part of this scene - the floor, a few decorative primitives, and a
// shape-spawning gadget - is hosted as a single JSON file living right next to this file
// (./level.json) and loaded in-memory, instead of being built up with engine calls like the
// "primitives" example does. Kept as a plain source file (not a shared/hosted asset) on purpose:
// open this example in StackBlitz, edit level.json, and rerun to see the change.

/**
 * Settings for the app-defined "ShapeSpawner" level entity below.
 */
interface ShapeSpawnerSettings {
  /**
   * Seconds between spawns
   */
  interval?: number;

  /**
   * Random-spawn-position bounding box
   */
  area: { min: Point2; max: Point2 };
}

/**
 * An app-defined level entity class: the "primitives" example spawns random falling shapes on a
 * timer imperatively; here that behavior is packaged as a class and registered against the
 * "ShapeSpawner" class alias below, so the level JSON can place one declaratively (see the
 * "ShapeSpawner" entry in level2d.json) instead of every app that wants it re-writing the timer
 * loop. Any class/function shape works as a generator - the level loader only requires
 * `(world, settings) => any`.
 */
class ShapeSpawner {
  constructor(world: Gg2dWorld, settings: ShapeSpawnerSettings) {
    const { min, max } = settings.area;
    const clock = world.createClock(true);
    clock.tickRateLimit = 1 / (settings.interval ?? 0.5);
    clock.tick$.subscribe(() => {
      let item: Entity2d;
      if (Math.random() >= 0.5) {
        item = world.addPrimitiveRigidBody({
          shape: { shape: 'SQUARE', dimensions: { x: 25, y: 25 } },
          body: { mass: 1 },
        });
      } else {
        item = world.addPrimitiveRigidBody({ shape: { shape: 'CIRCLE', radius: 13 }, body: { mass: 1 } });
      }
      item.position = {
        x: min.x + Math.random() * (max.x - min.x),
        y: min.y + Math.random() * (max.y - min.y),
      };
    });
  }
}

const world = new Gg2dWorld({
  visualScene: new PixiSceneComponent(),
  physicsWorld: new Rapier2dWorldComponent(),
});
world.init().then(async () => {
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;
  const renderer = world.addRenderer(new PixiCameraComponent(), canvas);

  renderer.rendererSize$.subscribe(newSize => {
    renderer.camera.zoom = Math.min(newSize.x / 850, newSize.y / 800, 1);
  });

  // Register the app-defined "ShapeSpawner" class before loading the level, so the loader can
  // dispatch its entry in level2d.json to it.
  world.loader.registerClass('ShapeSpawner', (w: Gg2dWorld, settings: ShapeSpawnerSettings) =>
    new ShapeSpawner(w, settings),
  );

  // Load the level (floor + a handful of static decorative primitives + the spawner)
  await world.loader.loadLevel(level);

  world.start();
});
