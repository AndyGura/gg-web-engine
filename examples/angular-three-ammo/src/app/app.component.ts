import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Vector3 } from 'three';
import { createInlineTickController, Gg3dEntity, Gg3dWorld, GgViewportManager } from '@gg-web-engine/core';
import { interval } from 'rxjs';
import { Gg3dVisualScene, GgRenderer } from '@gg-web-engine/three';
import { Gg3dPhysicsWorld } from '@gg-web-engine/ammo';

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
    const world: Gg3dWorld = new Gg3dWorld(scene, physScene);
    await world.init();

    const canvas = await GgViewportManager.instance.createCanvas(1);
    const renderer: GgRenderer = new GgRenderer(canvas);
    renderer.nativeCamera.lookAt(new Vector3(0, 0, 0));
    renderer.nativeCamera.up = new Vector3(0, 0, 1);
    world.addEntity(renderer);
    createInlineTickController(world).subscribe(([elapsed, _]) => {
      renderer.nativeCamera.position.x = 15 * Math.sin(elapsed / 2000);
      renderer.nativeCamera.position.y = 15 * Math.cos(elapsed / 2000);
      renderer.nativeCamera.position.z = 9;
      renderer.nativeCamera.lookAt(new Vector3(0, 0, 0));
    });
    renderer.activate();

    const floor = new Gg3dEntity(
      world.visualScene.factory.createBox({ x: 50, y: 50, z: 1 }),
      world.physicsWorld.factory.createBox({ x: 50, y: 50, z: 1 }, { dynamic: false }),
    );
    world.addEntity(floor);

    interval(500).subscribe(() => {
      let item: Gg3dEntity;
      if (Math.random() < 0.2) {
        item = new Gg3dEntity(
          world.visualScene.factory.createBox({ x: 1, y: 1, z: 1 }),
          world.physicsWorld.factory.createBox({ x: 1, y: 1, z: 1 }, { mass: 1 }),
        );
      } else if (Math.random() < 0.4) {
        item = new Gg3dEntity(
          world.visualScene.factory.createCapsule(0.5, 1),
          world.physicsWorld.factory.createCapsule(0.5, 1, { mass: 1 }),
        );
      } else if (Math.random() < 0.6) {
        item = new Gg3dEntity(
          world.visualScene.factory.createCylinder(0.5, 1),
          world.physicsWorld.factory.createCylinder(0.5, 1, { mass: 1 }),
        );
      } else if (Math.random() < 0.8) {
        item = new Gg3dEntity(
          world.visualScene.factory.createCone(0.5, 1),
          world.physicsWorld.factory.createCone(0.5, 1, { mass: 1 }),
        );
      } else {
        item = new Gg3dEntity(
          world.visualScene.factory.createSphere(0.5),
          world.physicsWorld.factory.createSphere(0.5, { mass: 1 }),
        );
      }
      item.position = { x: Math.random() * 5 - 2.5, y: Math.random() * 5 - 2.5, z: 10 };
      world.addEntity(item);
    });

    world.start();
  }
}
