import { PixiFactory } from './pixi-factory';
import { PixiDisplayObjectComponent } from './components/pixi-display-object.component';
import { PixiRendererComponent } from './components/pixi-renderer.component';
import { ApplicationOptions, Texture } from 'pixi.js';

export type PixiVisualTypeDocRepo2D = {
  factory: PixiFactory;
  displayObject: PixiDisplayObjectComponent;
  renderer: PixiRendererComponent;
  rendererExtraOpts: ApplicationOptions;
  texture: Texture;
};
