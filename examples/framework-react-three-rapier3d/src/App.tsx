import React, { useEffect, useRef } from 'react';
import {
  Trigger3dEntity,
  OrbitCameraController,
  Gg3dWorld,
  Entity3d,
  GgStatic,
} from '@gg-web-engine/core';
import {
  ThreeSceneComponent,
  ThreeCameraComponent,
} from '@gg-web-engine/three';
import { interval, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Rapier3dWorldComponent } from '@gg-web-engine/rapier3d';
import { PerspectiveCamera } from 'three';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const destroyed$ = useRef(new Subject<void>());

  useEffect(() => {
    const initializeApp = async () => {
      const world = new Gg3dWorld(
        new ThreeSceneComponent(),
        new Rapier3dWorldComponent()
      );
      await world.init();

      GgStatic.instance.showStats = true;
      // GgStatic.instance.devConsoleEnabled = true;

      const canvas = canvasRef.current!;
      const renderer = world.addRenderer(
        new ThreeCameraComponent(new PerspectiveCamera(75, 1, 1, 10000)),
        canvas
      );
      renderer.camera.position = { x: 9, y: 12, z: 9 };

      const controller = new OrbitCameraController(renderer, {
        mouseOptions: { canvas },
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
      destroyTrigger.position = { x: 0, y: 0, z: -15 };
      destroyTrigger.onEntityEntered.subscribe((entity) => {
        try {
          world.removeEntity(entity, true);
        } catch (err) {
          console.error(err, entity);
        }
      });
      world.addEntity(destroyTrigger);

      interval(500)
        .pipe(takeUntil(destroyed$.current))
        .subscribe(() => {
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
        });

      world.start();

      return () => {
        destroyed$.current.next();
        destroyed$.current.complete();
        world.dispose();
      };
    };

    initializeApp();
  }, []);

  return <canvas ref={canvasRef} id="gg"></canvas>;
};

export default App;
