import { PixiFactory } from './pixi-factory';
import { PixiDisplayObjectComponent } from './components/pixi-display-object.component';
import { PixiRendererComponent } from './components/pixi-renderer.component';
import { Texture } from 'pixi.js';

export type PixiVisualTypeDocRepo2D = {
  factory: PixiFactory;
  displayObject: PixiDisplayObjectComponent;
  renderer: PixiRendererComponent;
  texture: Texture;
};
