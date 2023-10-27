import { IGg2dObjectFactory, Shape2DDescriptor } from '@gg-web-engine/core';
import { PixiDisplayObjectComponent } from './components/pixi-display-object.component';
import { Graphics, Sprite, Texture } from 'pixi.js';

export class PixiFactory extends IGg2dObjectFactory<PixiDisplayObjectComponent> {
  getRandomColor(): number {
    return (
      (Math.floor(Math.random() * 256) << 16) | (Math.floor(Math.random() * 256) << 8) | Math.floor(Math.random() * 256)
    );
  }

  createPrimitive(descriptor: Shape2DDescriptor, texture: Texture | null = null): PixiDisplayObjectComponent {
    switch (descriptor.shape) {
      case 'SQUARE':
        const sprite = new Sprite(texture || Texture.WHITE);
        sprite.width = descriptor.dimensions.x;
        sprite.height = descriptor.dimensions.y;
        if (!texture) {
          sprite.tint = this.getRandomColor();
        }
        sprite.anchor.x = sprite.anchor.y = 0.5;
        return new PixiDisplayObjectComponent(sprite);
      case 'CIRCLE':
        if (texture) {
          // assume that texture is circular
          const sprite = new Sprite(texture);
          sprite.width = sprite.height = descriptor.radius * 2;
          sprite.anchor.x = sprite.anchor.y = 0.5;
          return new PixiDisplayObjectComponent(sprite);
        }
        const gr = new Graphics();
        gr.beginFill(this.getRandomColor());
        gr.drawCircle(0, 0, descriptor.radius);
        gr.endFill();
        return new PixiDisplayObjectComponent(gr);
    }
  }
}
