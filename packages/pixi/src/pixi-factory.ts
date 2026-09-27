import { DisplayObject2dOpts, IDisplayObject2dComponentFactory, Pnt2, Shape2DDescriptor } from '@gg-web-engine/core';
import { PixiDisplayObjectComponent } from './components/pixi-display-object.component';
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { PixiVisualTypeDocRepo2D } from './types';

export type PixiDisplayObject3dOpts = DisplayObject2dOpts<Texture>;

export class PixiFactory extends IDisplayObject2dComponentFactory<PixiVisualTypeDocRepo2D> {
  createPrimitive(descriptor: Shape2DDescriptor, material: PixiDisplayObject3dOpts = {}): PixiDisplayObjectComponent {
    switch (descriptor.shape) {
      case 'BOX':
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
          new Graphics().circle(0, 0, descriptor.radius).fill(material.color || this.randomColor()),
        );
      case 'CAPSULE': {
        const halfDistance = descriptor.centersDistance / 2;
        const radius = descriptor.radius;
        const graphics = new Graphics()
          .moveTo(radius, -halfDistance)
          .lineTo(radius, halfDistance)
          .arc(0, halfDistance, radius, 0, Math.PI)
          .lineTo(-radius, -halfDistance)
          .arc(0, -halfDistance, radius, Math.PI, Math.PI * 2)
          .fill(material.color || this.randomColor());
        return new PixiDisplayObjectComponent(graphics);
      }
      case 'CONVEX_HULL': {
        const graphics = new Graphics()
          .poly(Pnt2.hull(descriptor.vertices).map(v => ({ x: v.x, y: v.y })))
          .fill(material.color || this.randomColor());
        return new PixiDisplayObjectComponent(graphics);
      }
      case 'POLYGON': {
        const graphics = new Graphics()
          .poly(descriptor.vertices.map(v => ({ x: v.x, y: v.y })))
          .fill(material.color || this.randomColor());
        return new PixiDisplayObjectComponent(graphics);
      }
      case 'COMPOUND': {
        const container = new Container();
        for (const { position, rotation, shape } of descriptor.children) {
          const submesh = this.createPrimitive(shape, material).nativeSprite;
          if (position) {
            submesh.position.set(position.x, position.y);
          }
          if (rotation) {
            submesh.rotation = rotation;
          }
          container.addChild(submesh);
        }
        return new PixiDisplayObjectComponent(container);
      }
    }
  }
}
