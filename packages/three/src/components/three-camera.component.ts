import { ICameraComponent } from '@gg-web-engine/core';
import { Camera, PerspectiveCamera } from 'three';
import { ThreeDisplayObjectComponent } from './three-display-object.component';
import { ThreeSceneComponent } from './three-scene.component';

export class ThreeCameraComponent extends ThreeDisplayObjectComponent implements ICameraComponent<ThreeSceneComponent> {
  get supportsFov(): boolean {
    return this.nativeCamera instanceof PerspectiveCamera || this.nativeCamera.type == 'PerspectiveCamera';
  }

  get fov(): number {
    return (this.nativeCamera as PerspectiveCamera).fov || NaN;
  }

  set fov(f: number) {
    if (this.supportsFov) {
      (this.nativeCamera as PerspectiveCamera).fov = f;
      (this.nativeCamera as PerspectiveCamera).updateProjectionMatrix();
    }
  }

  constructor(public readonly nativeCamera: Camera) {
    super(nativeCamera);
  }
}
