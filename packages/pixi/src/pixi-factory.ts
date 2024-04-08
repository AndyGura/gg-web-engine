import { DisplayObject2dOpts, IDisplayObject2dComponentFactory, Shape2DDescriptor } from '@gg-web-engine/core';
import { PixiDisplayObjectComponent } from './components/pixi-display-object.component';
import { Graphics, Sprite, Texture } from 'pixi.js';
import { PixiVisualTypeDocRepo2D } from './types';

export type PixiDisplayObject3dOpts = DisplayObject2dOpts<Texture>;

export class PixiFactory extends IDisplayObject2dComponentFactory<PixiVisualTypeDocRepo2D> {
  createPrimitive(descriptor: Shape2DDescriptor, material: PixiDisplayObject3dOpts = {}): PixiDisplayObjectComponent {
    switch (descriptor.shape) {
      case 'SQUARE':
        const sprite = new Sprite(material.texture || Texture.WHITE);
        sprite.width = descriptor.dimensions.x;
        sprite.height = descriptor.dimensions.y;
        if (!material.texture) {
          sprite.tint = material.color || this.randomColor();
        }
        sprite.anchor.x = sprite.anchor.y = 0.5;
        return new PixiDisplayObjectComponent(sprite);
      case 'CIRCLE':
        if (material.texture) {
          // assume that texture is circular
          const sprite = new Sprite(material.texture);
          sprite.width = sprite.height = descriptor.radius * 2;
          sprite.anchor.x = sprite.anchor.y = 0.5;
          return new PixiDisplayObjectComponent(sprite);
        }
        return new PixiDisplayObjectComponent(
          new Graphics()
            .circle(0, 0, descriptor.radius)
            .fill(material.color || this.randomColor()),
        );
    }
  }
}
