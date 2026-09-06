import { ICamera2dComponent, Point2 } from '@gg-web-engine/core';
import { Container } from 'pixi.js';
import { PixiDisplayObjectComponent } from './pixi-display-object.component';
import { PixiVisualTypeDocRepo2D } from '../types';

export class PixiCameraComponent
  extends PixiDisplayObjectComponent
  implements ICamera2dComponent<PixiVisualTypeDocRepo2D>
{
  public zoom: number = 1;

  constructor() {
    super(new Container());
  }

  public worldToScreen(worldPoint: Point2): Point2 {
    return {
      x: (worldPoint.x - this.position.x) * this.zoom,
      y: (worldPoint.y - this.position.y) * this.zoom,
    };
  }

  public screenToWorld(screenPoint: Point2): Point2 {
    return {
      x: screenPoint.x / this.zoom + this.position.x,
      y: screenPoint.y / this.zoom + this.position.y,
    };
  }
}
