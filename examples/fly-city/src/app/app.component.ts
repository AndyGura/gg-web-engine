import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {
  CubeReflectionMapping,
  CubeTexture,
  CubeTextureLoader,
  DirectionalLight,
  PerspectiveCamera,
  RGBFormat
} from 'three';
import { FreeCameraController, Gg3dWorld, GgViewportManager, Mtrx4, Qtrn, MapGraph, Gg3dMapGraphEntity } from '@gg-web-engine/core';
import { Gg3dVisualScene, GgRenderer, ThreeCamera, ThreeCameraEntity } from '@gg-web-engine/three';
import { Gg3dPhysicsWorld } from '@gg-web-engine/ammo';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'fly-city';

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
    renderer.camera.position = { x: 0, y: 0, z: 10 };
    renderer.camera.rotation = Qtrn.fromMatrix4(Mtrx4.lookAt(
      renderer.camera.position,
      { x: 0, y: 10, z: 10 },
      { x: 0, y: 0, z: 1 },
    ));
    renderer.activate();

    const freeCameraController: FreeCameraController = new FreeCameraController(
      world.keyboardController,
      renderer.camera,
      {
        movementOptions: {
          speed: 5,
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

    const sun = new DirectionalLight(0xffffff, 3);
    sun.position.set(200, 150, 120);
    scene.nativeScene?.add(sun);
    const sky = new DirectionalLight(0xaaaaff, 0.4);
    sky.position.set(-200, -150, 20);
    scene.nativeScene?.add(sky);

    const envMap: CubeTexture = new CubeTextureLoader()
      .setPath(`assets/`)
      .load([
        'sky_nx.png', 'sky_px.png',
        'sky_py.png', 'sky_ny.png',
        'sky_pz.png', 'sky_nz.png'
      ]);
    envMap.format = RGBFormat;
    envMap.mapping = CubeReflectionMapping;
    scene.nativeScene!.background = envMap;

    const mapGraph = MapGraph.fromSquareGrid(
      Array(100).fill(null).map((_, i) => (
        Array(100).fill(null).map((_, j) => ({ path: 'assets/city_tile', position: { x: (j - 50) * 153, y: (i - 50) * 153, z: 0 }}))
      ))
    );
    const map = new Gg3dMapGraphEntity(mapGraph, { loadDepth: 5 });
    world.addEntity(map);
    map.loaderCursorEntity$.next(renderer.camera);

    world.start();

    console.log(world);
  }
}
