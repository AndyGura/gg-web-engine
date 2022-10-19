import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { PCFSoftShadowMap, sRGBEncoding, Vector3, WebGLRenderer } from 'three';
import { createInlineTickController, Gg3dEntity, Gg3dWorld, Point2 } from '@gg-web-engine/core';
import { interval } from 'rxjs';
import { Gg3dObjectFactory, Gg3dVisualScene, GgRenderer } from '@gg-web-engine/three';
import { Gg3dBodyFactory, Gg3dPhysicsWorld } from '@gg-web-engine/ammo';

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

    const renderer: GgRenderer = new GgRenderer(scene, webgl);
    renderer.nativeCamera.lookAt(new Vector3(0, 0, 0));
    world.addEntity(renderer);
    renderer.nativeCamera.up = new Vector3(0, 0, 1);
    createInlineTickController(world).subscribe(([elapsed, _]) => {
      renderer.nativeCamera.position.x = 15 * Math.sin(elapsed / 2000);
      renderer.nativeCamera.position.y = 15 * Math.cos(elapsed / 2000);
      renderer.nativeCamera.position.z = 9;
      renderer.nativeCamera.lookAt(new Vector3(0, 0, 0));
    });
    renderer.activate();

    const objectFactory = new Gg3dObjectFactory();
    const bodyFactory = new Gg3dBodyFactory(physScene);
    const floor = new Gg3dEntity(
      objectFactory.createBox(50, 50, 1),
      bodyFactory.createBox(50, 50, 1, 0),
    );
    world.addEntity(floor);

    interval(500).subscribe(() => {
      let item: Gg3dEntity;
      if (Math.random() >= 0.5) {
        item = new Gg3dEntity(
          objectFactory.createBox(1, 1, 1),
          bodyFactory.createBox(1, 1, 1, 1),
        );
      } else {
        item = new Gg3dEntity(
          objectFactory.createSphere(0.5),
          bodyFactory.createSphere(0.5, 1),
        );
      }
      item.position = { x: Math.random() * 5 - 2.5, y: Math.random() * 5 - 2.5, z: 10 };
      world.addEntity(item);
    });

    world.start();
  }
}
