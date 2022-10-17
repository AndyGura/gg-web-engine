import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Gg3dWorld, Point2, createInlineController } from '@gg-web-engine/core';
import { ThreeCameraRenderer, ThreeVisualScene } from '@gg-web-engine/three';
import { AmmoWorld } from '@gg-web-engine/ammo';
import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PCFSoftShadowMap,
  sRGBEncoding,
  Vector3,
  WebGLRenderer
} from 'three';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'angular-three-ammo';

  @ViewChild('stage') stage!: ElementRef<HTMLCanvasElement>;

  async ngOnInit(): Promise<void> {
    const scene: ThreeVisualScene = new ThreeVisualScene();
    const physScene: AmmoWorld = new AmmoWorld();
    const world: Gg3dWorld = new Gg3dWorld(scene, physScene);
    await world.init();

    const webgl = new WebGLRenderer({
      canvas: this.stage.nativeElement,
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: false,
    });
    const size: Point2 = { x: 800, y: 600 };
    webgl.setSize(size.x, size.y);
    webgl.physicallyCorrectLights = true;
    webgl.outputEncoding = sRGBEncoding;
    webgl.toneMappingExposure = 2;
    webgl.shadowMap.enabled = true;
    webgl.setClearColor(0x000000);
    webgl.shadowMap.type = PCFSoftShadowMap;
    webgl.setPixelRatio(devicePixelRatio);

    const renderer: ThreeCameraRenderer = new ThreeCameraRenderer(scene, webgl);
    renderer.nativeCamera.lookAt(new Vector3(0, 0, 0));
    world.addEntity(renderer);
    renderer.nativeCamera.up = new Vector3(0, 0, 1);
    createInlineController(world, (elapsed, _) => {
      renderer.nativeCamera.position.x = 5 * Math.sin(elapsed / 1000);
      renderer.nativeCamera.position.y = 5 * Math.cos(elapsed / 1000);
      renderer.nativeCamera.position.z = 3;
      renderer.nativeCamera.lookAt(new Vector3(0, 0, 0));
    });
    renderer.activate();

    const cube: Object3D = new Mesh(new BoxGeometry(3, 3, 3), new MeshBasicMaterial({ color: 0xff0000 }));
    scene.nativeScene!.add(cube);

    world.start();
  }
}
