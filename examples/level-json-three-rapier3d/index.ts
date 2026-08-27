import {
  Camera3dEntity,
  Entity3d,
  Gg3dWorld,
  GgStatic,
  OrbitCameraController,
  Point3,
  Trigger3dEntity,
  TypedGg3dWorld,
} from '@gg-web-engine/core';
import { ThreeGgWorld, ThreeSceneComponent, ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { Rapier3dGgWorld, Rapier3dWorldComponent } from '@gg-web-engine/rapier3d';
import { AmbientLight, DirectionalLight } from 'three';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

// The whole static part of this scene - floor, decorative primitives, a kill-zone trigger, the
// camera, and a shape-spawning gadget - is hosted as a single JSON file and loaded by URL, instead
// of being built up with engine calls like the "primitives" example does. See
// ../assets/level-json/level3d.json
const LEVEL_URL = 'https://gg-web-demos.guraklgames.com/assets/level-json/level3d.json';

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
  area: { min: Point3; max: Point3 };
}

/**
 * An app-defined level entity class: the "primitives" example spawns random falling shapes on a
 * timer imperatively; here that behavior is packaged as a class and registered against the
 * "ShapeSpawner" class alias below, so the level JSON can place one declaratively (see the
 * "ShapeSpawner" entry in level3d.json) instead of every app that wants it re-writing the timer
 * loop. Any class/function shape works as a generator - the level loader only requires
 * `(world, settings) => any`.
 */
class ShapeSpawner {
  constructor(world: Gg3dWorld, settings: ShapeSpawnerSettings) {
    const { min, max } = settings.area;
    const clock = world.createClock(true);
    clock.tickRateLimit = 1 / (settings.interval ?? 0.5);
    clock.tick$.subscribe(() => {
      let item: Entity3d;
      const r = Math.random();
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
        item = world.addPrimitiveRigidBody({ shape: { shape: 'SPHERE', radius: 0.5 }, body: { mass: 1 } });
      }
      item.position = {
        x: min.x + Math.random() * (max.x - min.x),
        y: min.y + Math.random() * (max.y - min.y),
        z: min.z + Math.random() * (max.z - min.z),
      };
    });
  }
}

const world: TypedGg3dWorld<ThreeGgWorld, Rapier3dGgWorld> = new Gg3dWorld({
  visualScene: new ThreeSceneComponent(),
  physicsWorld: new Rapier3dWorldComponent(),
});
world.init().then(async () => {
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;

  world.visualScene.nativeScene?.add(new AmbientLight(0xffffff, 0.6));
  const dirLight = new DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(50, 50, 70);
  dirLight.lookAt(0, 0, 0);
  world.visualScene.nativeScene?.add(dirLight);

  // Register the app-defined "ShapeSpawner" class before loading the level, so the loader can
  // dispatch its entry in level3d.json to it.
  world.loader.registerClass('ShapeSpawner', (w: Gg3dWorld, settings: ShapeSpawnerSettings) =>
    new ShapeSpawner(w, settings),
  );

  // Load the level. `loadLevelFromUrl` resolves to a group entity holding every entity the level
  // produced as a child - `world.removeEntity(level, true)` would tear the whole thing back down
  // in one call, e.g. to swap in a different level later (not needed in this example). Named
  // entities the level produced can be looked up by the `name` they were given in level3d.json
  // (floor/box/sphere/etc. are purely decorative and don't need to be looked up at all): entities
  // parented under the level - most of them - via `level.getChildEntityByName`; a `Camera`, which
  // deliberately isn't parented under the level (see below), via `world.getEntityByName` instead.
  const level = await world.loader.loadLevelFromUrl(LEVEL_URL);

  // `Camera` entities from a level are a plain camera component wrapped in an unparented
  // `Camera3dEntity` - not attached to any renderer/canvas (a level JSON has no notion of one),
  // and deliberately not part of the level's group entity, so an app-owned camera survives level
  // swaps untouched. Attach it to a renderer explicitly, same as any other camera.
  const cameraEntity = world.getEntityByName<Camera3dEntity<ThreeVisualTypeDocRepo>>('MainCamera');
  const renderer = world.addRenderer(cameraEntity.camera, canvas);
  const controller = new OrbitCameraController(renderer, { mouseOptions: { canvas } });
  world.addEntity(controller);

  // `Trigger` entities, unlike `Camera`, come back ready-to-use - already a `Trigger3dEntity`
  // parented under the level's group entity (so already part of the world) - just subscribe to it.
  const killZone = level.getChildEntityByName<Trigger3dEntity>('KillFloor');
  killZone.onEntityEntered.subscribe((entity: Entity3d) => {
    world.removeEntity(entity, true);
  });

  world.start();
});
