import { ThreeFactory } from './three-factory';
import { ThreeLoader } from './three-loader';
import { ThreeDisplayObjectComponent } from './components/three-display-object.component';
import { ThreeRendererComponent } from './components/three-renderer.component';
import { ThreeCameraComponent } from './components/three-camera.component';
import { Texture, WebGLRendererParameters } from 'three';
import { Gg3dWorld, Gg3dWorldSceneTypeDocVPatch, Gg3dWorldTypeDocVPatch } from '@gg-web-engine/core';
import { ThreeSceneComponent } from './components/three-scene.component';

export type ThreeVisualTypeDocRepo = {
  factory: ThreeFactory;
  loader: ThreeLoader;
  displayObject: ThreeDisplayObjectComponent;
  renderer: ThreeRendererComponent;
  rendererExtraOpts: WebGLRendererParameters;
  camera: ThreeCameraComponent;
  texture: Texture;
};

export type ThreeGgWorld = Gg3dWorld<
  Gg3dWorldTypeDocVPatch<ThreeVisualTypeDocRepo>,
  Gg3dWorldSceneTypeDocVPatch<ThreeVisualTypeDocRepo, ThreeSceneComponent>
>;
