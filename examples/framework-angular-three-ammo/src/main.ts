import 'zone.js/dist/zone';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { Entity3d, Gg3dWorld, GgStatic, OrbitCameraController, Trigger3dEntity } from '@gg-web-engine/core';
import { ThreeSceneComponent, ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { AmmoPhysicsTypeDocRepo, AmmoWorldComponent } from '@gg-web-engine/ammo';
import { interval, Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'my-app',
  standalone: true,
  template: `
      <canvas id='gg'></canvas>`,
})
export class App implements OnInit, OnDestroy {
  private world!: Gg3dWorld<ThreeVisualTypeDocRepo, AmmoPhysicsTypeDocRepo, ThreeSceneComponent, AmmoWorldComponent>;
  private destroyed$: Subject<void> = new Subject<void>();

  async ngOnInit(): Promise<void> {
    this.world = new Gg3dWorld(
      new ThreeSceneComponent(),
      new AmmoWorldComponent(),
    );
    await this.world.init();
    GgStatic.instance.showStats = true;
    // GgStatic.instance.devConsoleEnabled = true;

    const canvas = document.getElementById('gg')! as HTMLCanvasElement;
    const renderer = this.world.addRenderer(
      this.world.visualScene.factory.createPerspectiveCamera({ fov: 75 }),
      canvas,
    );
    renderer.position = { x: 9, y: 12, z: 9 };

    const controller = new OrbitCameraController(renderer, {
      mouseOptions: { canvas },
    });
    this.world.addEntity(controller);

    this.world.addPrimitiveRigidBody({
      shape: { shape: 'BOX', dimensions: { x: 7, y: 7, z: 1 } },
      body: { dynamic: false },
    });

    const destroyTrigger = new Trigger3dEntity(
      this.world.physicsWorld.factory.createTrigger({
        shape: 'BOX',
        dimensions: { x: 1000, y: 1000, z: 1 },
      }),
    );
    destroyTrigger.position = { x: 0, y: 0, z: -15 };
    destroyTrigger.onEntityEntered.subscribe((entity: Entity3d) => {
      this.world.removeEntity(entity, true);
    });
    this.world.addEntity(destroyTrigger);

    interval(500)
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => {
        let item: Entity3d;
        let r = Math.random();
        if (r < 0.2) {
          item = this.world.addPrimitiveRigidBody({
            shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } },
            body: { mass: 1 },
          });
        } else if (r < 0.4) {
          item = this.world.addPrimitiveRigidBody({
            shape: { shape: 'CAPSULE', radius: 0.5, centersDistance: 1 },
            body: { mass: 1 },
          });
        } else if (r < 0.6) {
          item = this.world.addPrimitiveRigidBody({
            shape: { shape: 'CYLINDER', radius: 0.5, height: 1 },
            body: { mass: 1 },
          });
        } else if (r < 0.8) {
          item = this.world.addPrimitiveRigidBody({
            shape: { shape: 'CONE', radius: 0.5, height: 1 },
            body: { mass: 1 },
          });
        } else {
          item = this.world.addPrimitiveRigidBody({
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

    this.world.start();
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
    this.world.dispose();
  }
}

bootstrapApplication(App);
