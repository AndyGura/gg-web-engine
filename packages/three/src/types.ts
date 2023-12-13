import { ThreeFactory } from './three-factory';
import { ThreeLoader } from './three-loader';
import { ThreeDisplayObjectComponent } from './components/three-display-object.component';
import { ThreeRendererComponent } from './components/three-renderer-component';
import { ThreeCameraComponent } from './components/three-camera.component';
import { Texture } from 'three';

export type ThreeVisualTypeDocRepo = {
  factory: ThreeFactory;
  loader: ThreeLoader;
  displayObject: ThreeDisplayObjectComponent;
  renderer: ThreeRendererComponent;
  camera: ThreeCameraComponent;
  texture: Texture;
};
