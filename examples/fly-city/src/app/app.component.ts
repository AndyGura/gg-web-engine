import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { AmbientLight, DirectionalLight, HemisphereLight, PerspectiveCamera } from 'three';
import { FreeCameraController, Gg3dWorld, GgViewportManager, Mtrx4, Qtrn, } from '@gg-web-engine/core';
import { Gg3dVisualScene, GgRenderer } from '@gg-web-engine/three';
import { Gg3dPhysicsWorld } from '@gg-web-engine/ammo';
import { ThreeCameraEntity } from '@gg-web-engine/three/dist/impl/three-camera.entity';
import { ThreeCamera } from '@gg-web-engine/three/dist/impl/three-camera';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'model-loader';

  @ViewChild('stage') stage!: ElementRef<HTMLCanvasElement>;

  async ngOnInit(): Promise<void> {

    const scene: Gg3dVisualScene = new Gg3dVisualScene();
    const physScene: Gg3dPhysicsWorld = new Gg3dPhysicsWorld();
    const world: Gg3dWorld = new Gg3dWorld(scene, physScene, true);
    await world.init();

    const canvas = await GgViewportManager.instance.createCanvas(1);
    const renderer: GgRenderer = new GgRenderer(canvas, {}, new ThreeCameraEntity(
      new ThreeCamera(new PerspectiveCamera(75, 1, 1, 10000)),
      world.physicsWorld.factory.createSphere(2, {}),
    ));
    world.addEntity(renderer);
    renderer.camera.position = { x: 0, y: 120, z: 112 };
    renderer.camera.rotation = Qtrn.fromMatrix4(Mtrx4.lookAt(
      renderer.camera.position,
      { x: 0, y: 0, z: 10 },
      { x: 0, y: 0, z: 1 },
    ));
    renderer.activate();

    const freeCameraController: FreeCameraController = new FreeCameraController(
      world.keyboardController,
      renderer.camera,
      {
        movementOptions: {
          speed: 3,
        },
        mouseOptions: {
          pointerLock: {
            ignoreMovementWhenNotLocked: true,
            canvas,
          },
        },
      },
    );
    freeCameraController.start();

    const sun = new DirectionalLight();
    sun.position.set(200, 150, 120);
    scene.nativeScene?.add(sun);

    const hemiLight = new HemisphereLight(0xffffff, 0xffffff, 0.6);
    hemiLight.color.setHSL(0.6, 1, 0.6);
    hemiLight.groundColor.setHSL(0.095, 1, 0.75);
    hemiLight.position.set(0, 50, 0);
    scene.nativeScene?.add(hemiLight);

    const { entities, props } = await world.loader.loadGgGlb('assets/city');
    for (const item of entities) {
      world.addEntity(item);
    }
    for (const prop of props || []) {
      for (const item of prop.entities) {
        world.addEntity(item);
      }
    }

    world.start();

    console.log(world);
  }
}
