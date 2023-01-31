import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { DirectionalLight, HemisphereLight, Vector3 } from 'three';
import { createInlineTickController, Gg3dWorld, GgViewportManager } from '@gg-web-engine/core';
import { interval } from 'rxjs';
import { Gg3dObject, Gg3dVisualScene, GgRenderer } from '@gg-web-engine/three';
import { Gg3dPhysicsWorld } from '@gg-web-engine/ammo';

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
    const renderer: GgRenderer = new GgRenderer(canvas);
    renderer.nativeCamera.lookAt(new Vector3(0, 0, 0));
    renderer.nativeCamera.up = new Vector3(0, 0, 1);
    world.addEntity(renderer);
    createInlineTickController(world).subscribe(([elapsed, _]) => {
      renderer.nativeCamera.position.x = 10 * Math.sin(elapsed / 2000);
      renderer.nativeCamera.position.y = 10 * Math.cos(elapsed / 2000);
      renderer.nativeCamera.position.z = 6;
      renderer.nativeCamera.lookAt(new Vector3(0, 0, 0));
    });
    renderer.activate();

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
        (item.object3D as Gg3dObject).nativeMesh.traverse((obj) => {
          obj.castShadow = true;
          obj.receiveShadow = true;
        });
      }
      world.addEntity(item);
    }

    // (window as any).gg.console('dr_drawphysics 1');

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
      const { entities } = await world.loader.loadGgGlb('assets/' + glbId);
      const item = entities[0];
      item.position = { x: Math.random() * 5 - 2.5, y: Math.random() * 5 - 2.5, z: 10 };
      (item.object3D as Gg3dObject).nativeMesh.traverse((obj) => {
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
