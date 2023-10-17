import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { DirectionalLight, HemisphereLight, PerspectiveCamera } from 'three';
import { Camera3dAnimator, Gg3dWorld, Pnt3 } from '@gg-web-engine/core';
import { interval } from 'rxjs';
import { ThreeCameraComponent, ThreeDisplayObjectComponent, ThreeSceneComponent } from '@gg-web-engine/three';
import { AmmoWorldComponent } from '@gg-web-engine/ammo';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {

  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;

  async ngOnInit(): Promise<void> {

    const scene: ThreeSceneComponent = new ThreeSceneComponent();
    scene.loader.registerGltfLoaderAddon(new GLTFLoader());
    const physScene: AmmoWorldComponent = new AmmoWorldComponent();
    const world: Gg3dWorld = new Gg3dWorld(scene, physScene, true);
    await world.init();

    const renderer = world.addRenderer(
      new ThreeCameraComponent(new PerspectiveCamera(75, 1, 1, 10000)),
      this.canvas.nativeElement,
    );
    const cameraController: Camera3dAnimator = new Camera3dAnimator(renderer, (timeElapsed, _) => ({
      position: {
        x: 10 * Math.sin(timeElapsed / 2000),
        y: 10 * Math.cos(timeElapsed / 2000),
        z: 6,
      },
      target: Pnt3.O,
    }));
    world.addEntity(cameraController);

    const hemiLight = new HemisphereLight(0xffffff, 0xffffff, 0.6);
    hemiLight.color.setHSL(0.6, 1, 0.6);
    hemiLight.groundColor.setHSL(0.095, 1, 0.75);
    hemiLight.position.set(0, 50, 0);
    scene.nativeScene?.add(hemiLight);
    const dirLight = new DirectionalLight(0xffffff, 1);
    dirLight.color.setHSL(0.1, 1, 0.95);
    dirLight.position.set(50, 50, 70);
    dirLight.lookAt(0, 0, 0);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    const d = 20;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.camera.far = 3500;
    scene.nativeScene?.add(dirLight);

    const { entities } = await world.loader.loadGgGlb('assets/ph_scene');
    for (const item of entities) {
      if (item.object3D) {
        (item.object3D as ThreeDisplayObjectComponent).nativeMesh.traverse((obj) => {
          obj.castShadow = true;
          obj.receiveShadow = true;
        });
      }
      world.addEntity(item);
    }

    interval(500).subscribe(async () => {
      const itemTypeRand = Math.random();
      let glbId = '';
      if (itemTypeRand < 1 / 7) {
        glbId = 'ball';
      } else if (itemTypeRand < 2 / 7) {
        glbId = 'dice';
      } else if (itemTypeRand < 3 / 7) {
        glbId = 'christmas_tree';
      } else if (itemTypeRand < 4 / 7) {
        glbId = 'battery';
      } else if (itemTypeRand < 5 / 7) {
        glbId = 'capsule';
      } else if (itemTypeRand < 6 / 7) {
        glbId = 'convex_hull';
      } else {
        glbId = 'compound';
      }
      const { entities } = await world.loader.loadGgGlb('assets/' + glbId, {
        position: {
          x: Math.random() * 5 - 2.5,
          y: Math.random() * 5 - 2.5,
          z: 10,
        },
      });
      const item = entities[0];
      (item.object3D as ThreeDisplayObjectComponent).nativeMesh.traverse((obj) => {
        obj.castShadow = true;
        obj.receiveShadow = true;
      });
      world.addEntity(item);
      setTimeout(() => {
        world.removeEntity(item, true);
      }, 30000);
    });

    world.start();
  }
}
