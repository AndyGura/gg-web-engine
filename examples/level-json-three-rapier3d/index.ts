import {
  Entity3d,
  Gg3dWorld,
  GgStatic,
  OrbitCameraController,
  Trigger3dEntity,
  TypedGg3dWorld,
} from '@gg-web-engine/core';
import { ThreeGgWorld, ThreeSceneComponent } from '@gg-web-engine/three';
import { Rapier3dGgWorld, Rapier3dWorldComponent } from '@gg-web-engine/rapier3d';
import { AmbientLight, DirectionalLight } from 'three';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

// The whole static part of this scene - floor, decorative primitives, a kill-zone trigger and
// the camera - is hosted as a single JSON file and loaded by URL, instead of being built up with
// engine calls like the "primitives" example does. See ../assets/level-json/level3d.json
const LEVEL_URL = 'https://gg-web-demos.guraklgames.com/assets/level-json/level3d.json';

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

  // Load the level. Entities come back in the same order as `entities` in the JSON document -
  // here that's [floor, box, sphere, capsule, cylinder, cone, kill-zone trigger, camera].
  const [, , , , , , killZoneTrigger, camera] = await world.loader.loadLevelFromUrl(LEVEL_URL);

  // `Camera` entities from a level are a plain camera component (a level JSON has no notion of a
  // canvas), so it still needs to be attached to a renderer explicitly, same as any other camera.
  const renderer = world.addRenderer(camera, canvas);
  const controller = new OrbitCameraController(renderer, { mouseOptions: { canvas } });
  world.addEntity(controller);

  // Same for `Trigger` entities - the level loader hands back the raw physics trigger component,
  // so wiring it into the world (and into game logic) is left to the app, same as if it had been
  // created directly via `world.physicsWorld.factory.createTrigger(...)`.
  const killZone = new Trigger3dEntity(killZoneTrigger);
  world.addEntity(killZone);
  killZone.onEntityEntered.subscribe((entity: Entity3d) => {
    world.removeEntity(entity, true);
  });

  // Beyond the level content, the world still behaves like any other `Gg3dWorld` - e.g. this
  // spawns new primitives imperatively, the same way the "primitives" example does.
  const spawnTimer = world.createClock(true);
  spawnTimer.tickRateLimit = 2;
  spawnTimer.tick$.subscribe(() => {
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
