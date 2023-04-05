import { Component, OnInit } from '@angular/core';
import {
  Camera3dAnimator,
  Gg3dEntity,
  Gg3dTriggerEntity,
  Gg3dWorld,
  GgPositionable3dEntity,
  GgViewportManager,
} from '@gg-web-engine/core';
import { interval } from 'rxjs';
import { Gg3dVisualScene, GgRenderer } from '@gg-web-engine/three';
import { Gg3dPhysicsWorld } from '@gg-web-engine/ammo';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {

  async ngOnInit(): Promise<void> {

    const scene: Gg3dVisualScene = new Gg3dVisualScene();
    const physScene: Gg3dPhysicsWorld = new Gg3dPhysicsWorld();
    const world: Gg3dWorld = new Gg3dWorld(scene, physScene, true);
    await world.init();

    const canvas = await GgViewportManager.instance.createCanvas(1);
    const renderer: GgRenderer = new GgRenderer(canvas);
    world.addEntity(renderer);
    const cameraController: Camera3dAnimator = new Camera3dAnimator(renderer.camera, (timeElapsed, _) => ({
      position: {
        x: 15 * Math.sin(timeElapsed / 2000),
        y: 15 * Math.cos(timeElapsed / 2000),
        z: 9,
      },
      target: { x: 0, y: 0, z: 0 },
    }));
    world.addEntity(cameraController);
    renderer.activate();

    world.addPrimitiveRigidBody({
      shape: { shape: 'BOX', dimensions: { x: 7, y: 7, z: 1 } },
      body: { dynamic: false },
    });

    const destroyTrigger = new Gg3dTriggerEntity(world.physicsWorld.factory.createTrigger({
      shape: 'BOX',
      dimensions: { x: 1000, y: 1000, z: 1 },
    }));
    destroyTrigger.position = { x: 0, y: 0, z: -15 };
    destroyTrigger.onEntityEntered.subscribe((entity: GgPositionable3dEntity) => {
      world.removeEntity(entity, true);
    });
    world.addEntity(destroyTrigger);

    interval(500).subscribe(() => {
      let item: Gg3dEntity;
      if (Math.random() < 0.2) {
        item = world.addPrimitiveRigidBody({
          shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } },
          body: { mass: 1 },
        });
      } else if (Math.random() < 0.4) {
        item = world.addPrimitiveRigidBody({
          shape: { shape: 'CAPSULE', radius: 0.5, centersDistance: 1 },
          body: { mass: 1 },
        });
      } else if (Math.random() < 0.6) {
        item = world.addPrimitiveRigidBody({
          shape: { shape: 'CYLINDER', radius: 0.5, height: 1 },
          body: { mass: 1 },
        });
      } else if (Math.random() < 0.8) {
        item = world.addPrimitiveRigidBody({ shape: { shape: 'CONE', radius: 0.5, height: 1 }, body: { mass: 1 } });
      } else {
        item = world.addPrimitiveRigidBody({ shape: { shape: 'SPHERE', radius: 0.5 }, body: { mass: 1 } });
      }
      item.position = { x: Math.random() * 5 - 2.5, y: Math.random() * 5 - 2.5, z: 10 };
    });

    world.start();
  }
}
