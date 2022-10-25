import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Gg2dEntity, Gg2dWorld, GgViewport, GgViewportManager, Point2 } from '@gg-web-engine/core';
import { interval } from 'rxjs';
import { Gg2dObjectFactory, Gg2dVisualScene, GgRenderer } from '@gg-web-engine/pixi';
import { Gg2dBodyFactory, Gg2dPhysicsWorld } from '@gg-web-engine/matter';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'angular-three-ammo';

  @ViewChild('stage') stage!: ElementRef<HTMLCanvasElement>;

  async ngOnInit(): Promise<void> {

    const scene: Gg2dVisualScene = new Gg2dVisualScene();
    const physScene: Gg2dPhysicsWorld = new Gg2dPhysicsWorld();
    const world: Gg2dWorld = new Gg2dWorld(scene, physScene);
    await world.init();

    const canvas = await GgViewportManager.instance.createCanvas(1);
    const renderer: GgRenderer = new GgRenderer(canvas);
    world.addEntity(renderer);
    renderer.activate();

    const objectFactory = new Gg2dObjectFactory();
    const bodyFactory = new Gg2dBodyFactory();

    const floor = new Gg2dEntity(
      objectFactory.createSquare(800, 100),
      bodyFactory.createSquare(800, 100, 0),
    );
    GgViewport.instance.subscribeOnViewportSize().subscribe((newSize: Point2) => {
      floor.position = { x: newSize.x / 2, y: newSize.y - 75 };
    });
    world.addEntity(floor);

    interval(500).subscribe(() => {
      let item: Gg2dEntity;
      if (Math.random() >= 0.5) {
        item = new Gg2dEntity(
          objectFactory.createSquare(25, 25),
          bodyFactory.createSquare(25, 25, 1),
        );
      } else {
        item = new Gg2dEntity(
          objectFactory.createCircle(13),
          bodyFactory.createCircle(13, 1),
        );
      }
      item.position = { x: GgViewport.instance.getCurrentViewportSize().x / 2 + Math.random() * 100 - 50, y: 75 };
      world.addEntity(item);
    });

    world.start();
  }
}
