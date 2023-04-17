import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { Gg2dEntity, Gg2dWorld } from '@gg-web-engine/core';
import { interval } from 'rxjs';
import { Gg2dVisualScene, GgRenderer } from '@gg-web-engine/pixi';
import { Gg2dPhysicsWorld } from '@gg-web-engine/matter';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements AfterViewInit {

  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;

  async ngAfterViewInit(): Promise<void> {

    const scene: Gg2dVisualScene = new Gg2dVisualScene();
    const physScene: Gg2dPhysicsWorld = new Gg2dPhysicsWorld();
    const world: Gg2dWorld = new Gg2dWorld(scene, physScene);
    await world.init();

    const renderer: GgRenderer = new GgRenderer(this.canvas.nativeElement);
    world.addEntity(renderer);

    const floor = world.addPrimitiveRigidBody({
      shape: { shape: 'SQUARE', dimensions: { x: 800, y: 100 } },
      body: { dynamic: false },
    });
    renderer.rendererSize$.subscribe((newSize) => {
      if (newSize) {
        floor.position = { x: newSize.x / 2, y: newSize.y - 75 };
      }
    });

    interval(500).subscribe(() => {
      let item: Gg2dEntity;
      if (Math.random() >= 0.5) {
        item = world.addPrimitiveRigidBody({
          shape: { shape: 'SQUARE', dimensions: { x: 25, y: 25 } },
          body: { mass: 1 },
        });
      } else {
        item = world.addPrimitiveRigidBody({ shape: { shape: 'CIRCLE', radius: 13 }, body: { mass: 1 } });
      }
      item.position = { x: (renderer.rendererSize!.x || 800) / 2 + Math.random() * 100 - 50, y: 75 };
    });

    world.start();
  }
}
