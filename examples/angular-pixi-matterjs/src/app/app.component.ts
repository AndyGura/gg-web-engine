import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { Entity2d, Gg2dWorld } from '@gg-web-engine/core';
import { interval } from 'rxjs';
import { PixiSceneComponent } from '@gg-web-engine/pixi';
import { MatterWorldComponent } from '@gg-web-engine/matter';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements AfterViewInit {

  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;

  async ngAfterViewInit(): Promise<void> {

    const scene: PixiSceneComponent = new PixiSceneComponent();
    const physScene: MatterWorldComponent = new MatterWorldComponent();
    const world: Gg2dWorld = new Gg2dWorld(scene, physScene);
    await world.init();

    const renderer = world.addRenderer(this.canvas.nativeElement);

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
      let item: Entity2d;
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
