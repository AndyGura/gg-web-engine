import { useRef, useEffect } from 'react';
import {
  Trigger3dEntity,
  OrbitCameraController,
  Gg3dWorld,
  Entity3d,
  GgStatic,
} from '@gg-web-engine/core';
import { ThreeSceneComponent } from '@gg-web-engine/three';
import { Rapier3dWorldComponent } from '@gg-web-engine/rapier3d';

const isNewWorld = !GgStatic.instance.selectedWorld;
const world =
  (GgStatic.instance.selectedWorld as Gg3dWorld) ||
  new Gg3dWorld(new ThreeSceneComponent(), new Rapier3dWorldComponent());
if (isNewWorld) {
  world.init().then(() => {
    world.start();
    GgStatic.instance.showStats = true;
    GgStatic.instance.devConsoleEnabled = true;
  });
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spawnTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const initializeWorld = async () => {
      while (!world.isRunning) {
        await new Promise((r) => setTimeout(r, 50));
      }
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
      }
      for (const e of world.children) {
        if (!e.name.startsWith('fps_meter')) {
          world.removeEntity(e, true);
        }
      }
      const renderer = world.addRenderer(
        world.visualScene.factory.createPerspectiveCamera({}),
        canvasRef.current!
      );
      renderer.position = { x: 9, y: 12, z: 9 };

      const controller = new OrbitCameraController(renderer, {
        mouseOptions: { canvas: canvasRef.current! },
      });
      world.addEntity(controller);

      world.addPrimitiveRigidBody({
        shape: { shape: 'BOX', dimensions: { x: 7, y: 7, z: 1 } },
        body: { dynamic: false },
      });

      const destroyTrigger = new Trigger3dEntity(
        world.physicsWorld.factory.createTrigger({
          shape: 'BOX',
          dimensions: { x: 1000, y: 1000, z: 1 },
        })
      );
      destroyTrigger.position = { x: 0, y: 0, z: -5 };
      destroyTrigger.onEntityEntered.subscribe((entity) => {
        try {
          world.removeEntity(entity, true);
        } catch (err) {
          console.error(err, entity);
        }
      });
      world.addEntity(destroyTrigger);

      spawnTimerRef.current = window.setInterval(() => {
        let item: Entity3d;
        const random = Math.random();
        if (random < 0.2) {
          item = world.addPrimitiveRigidBody({
            shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } },
            body: { mass: 1 },
          });
        } else if (random < 0.4) {
          item = world.addPrimitiveRigidBody({
            shape: { shape: 'CAPSULE', radius: 0.5, centersDistance: 1 },
            body: { mass: 1 },
          });
        } else if (random < 0.6) {
          item = world.addPrimitiveRigidBody({
            shape: { shape: 'CYLINDER', radius: 0.5, height: 1 },
            body: { mass: 1 },
          });
        } else if (random < 0.8) {
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
      }, 500);
    };

    initializeWorld();

    // Cleanup on unmount or dependency change
    return () => {
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} id="gg"></canvas>
    </>
  );
}

export default App;
