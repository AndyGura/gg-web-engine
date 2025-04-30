import { PixiFactory } from './pixi-factory';
import { PixiDisplayObjectComponent } from './components/pixi-display-object.component';
import { PixiRendererComponent } from './components/pixi-renderer.component';
import { ApplicationOptions, Texture } from 'pixi.js';
import { Gg2dWorld, Gg2dWorldSceneTypeDocVPatch, Gg2dWorldTypeDocVPatch } from '@gg-web-engine/core';
import { PixiSceneComponent } from './components/pixi-scene.component';

export type PixiVisualTypeDocRepo2D = {
  factory: PixiFactory;
  displayObject: PixiDisplayObjectComponent;
  renderer: PixiRendererComponent;
  rendererExtraOpts: ApplicationOptions;
  texture: Texture;
};

export type PixiGgWorld = Gg2dWorld<
  Gg2dWorldTypeDocVPatch<PixiVisualTypeDocRepo2D>,
  Gg2dWorldSceneTypeDocVPatch<PixiVisualTypeDocRepo2D, PixiSceneComponent>
>;
