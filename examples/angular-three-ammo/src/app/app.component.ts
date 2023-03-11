import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {
  createInlineTickController,
  Gg3dEntity,
  Gg3dWorld,
  GgViewportManager,
  Gg3dTriggerEntity,
  GgPositionable3dEntity,
  Qtrn
} from '@gg-web-engine/core';
import {interval} from 'rxjs';
import {Gg3dVisualScene, GgRenderer} from '@gg-web-engine/three';
import {Gg3dPhysicsWorld} from '@gg-web-engine/ammo';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'angular-three-ammo';

  @ViewChild('stage') stage!: ElementRef<HTMLCanvasElement>;

  async ngOnInit(): Promise<void> {

    const scene: Gg3dVisualScene = new Gg3dVisualScene();
    const physScene: Gg3dPhysicsWorld = new Gg3dPhysicsWorld();
    const world: Gg3dWorld = new Gg3dWorld(scene, physScene, true);
    await world.init();

    const canvas = await GgViewportManager.instance.createCanvas(1);
    const renderer: GgRenderer = new GgRenderer(canvas);
    world.addEntity(renderer);
    createInlineTickController(world).subscribe(([elapsed, _]) => {
      renderer.camera.position = {
        x: 15 * Math.sin(elapsed / 2000),
        y: 15 * Math.cos(elapsed / 2000),
        z: 9,
      };
      renderer.camera.rotation = Qtrn.lookAt(renderer.camera.position, {x: 0, y: 0, z: 0}, {x: 0, y: 0, z: 1});
    });
    renderer.activate();

    const floor = new Gg3dEntity(
      world.visualScene.factory.createBox({x: 7, y: 7, z: 1}),
      world.physicsWorld.factory.createRigidBody({
        shape: {shape: 'BOX', dimensions: {x: 7, y: 7, z: 1}},
        body: {dynamic: false}
      }),
    );
    world.addEntity(floor);

    const destroyTrigger = new Gg3dTriggerEntity(world.physicsWorld.factory.createTrigger({
      shape: 'BOX',
      dimensions: {x: 1000, y: 1000, z: 1}
    }));
    destroyTrigger.position = {x: 0, y: 0, z: -5};
    destroyTrigger.onEntityEntered.subscribe((entity: GgPositionable3dEntity) => {
      console.log(entity);
      // world.removeEntity(entity, true);
    });
    world.addEntity(destroyTrigger);

    interval(500).subscribe(() => {
      let item: Gg3dEntity;
      if (Math.random() < 0.2) {
        item = new Gg3dEntity(
          world.visualScene.factory.createBox({x: 1, y: 1, z: 1}),
          world.physicsWorld.factory.createRigidBody({
            shape: {shape: 'BOX', dimensions: {x: 1, y: 1, z: 1}},
            body: {mass: 1}
          }),
        );
      } else if (Math.random() < 0.4) {
        item = new Gg3dEntity(
          world.visualScene.factory.createCapsule(0.5, 1),
          world.physicsWorld.factory.createRigidBody({
            shape: {shape: 'CAPSULE', radius: 0.5, centersDistance: 1},
            body: {mass: 1}
          }),
        );
      } else if (Math.random() < 0.6) {
        item = new Gg3dEntity(
          world.visualScene.factory.createCylinder(0.5, 1),
          world.physicsWorld.factory.createRigidBody({
            shape: {shape: 'CYLINDER', radius: 0.5, height: 1},
            body: {mass: 1}
          }),
        );
      } else if (Math.random() < 0.8) {
        item = new Gg3dEntity(
          world.visualScene.factory.createCone(0.5, 1),
          world.physicsWorld.factory.createRigidBody({shape: {shape: 'CONE', radius: 0.5, height: 1}, body: {mass: 1}}),
        );
      } else {
        item = new Gg3dEntity(
          world.visualScene.factory.createSphere(0.5),
          world.physicsWorld.factory.createRigidBody({shape: {shape: 'SPHERE', radius: 0.5}, body: {mass: 1}}),
        );
      }
      item.position = {x: Math.random() * 5 - 2.5, y: Math.random() * 5 - 2.5, z: 10};
      world.addEntity(item);
    });

    world.start();
  }
}
