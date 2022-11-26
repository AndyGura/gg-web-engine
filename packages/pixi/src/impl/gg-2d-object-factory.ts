import { IGg2dObjectFactory, Point2 } from '@gg-web-engine/core';
import { Gg2dObject } from './gg-2d-object';
import { Graphics, Sprite, Texture } from 'pixi.js';

export class Gg2dObjectFactory implements IGg2dObjectFactory {
  getRandomColor(): number {
    return Math.floor(Math.random() * 256) << 16 | Math.floor(Math.random() * 256) << 8 | Math.floor(Math.random() * 256);
  }

  createSquare(dimensions: Point2, texture: Texture | null = null): Gg2dObject {
    const sprite = new Sprite(texture || Texture.WHITE);
    sprite.width = dimensions.x;
    sprite.height = dimensions.y;
    if (!texture) {
      sprite.tint = this.getRandomColor();
    }
    sprite.anchor.x = sprite.anchor.y = 0.5;
    return new Gg2dObject(sprite);
  }

  createCircle(radius: number, texture: Texture | null = null): Gg2dObject {
    if (texture) {
      // assume that texture is circular
      return this.createSquare({ x: radius * 2, y: radius * 2 }, texture);
    }
    const gr = new Graphics();
    gr.beginFill(this.getRandomColor());
    gr.drawCircle(0, 0, radius);
    gr.endFill();
    return new Gg2dObject(gr);
  }
}
