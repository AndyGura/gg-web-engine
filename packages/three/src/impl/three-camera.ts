import { IGg3dCamera } from '@gg-web-engine/core';
import { Camera, PerspectiveCamera } from 'three';
import { Gg3dObject } from './gg-3d-object';

export class ThreeCamera extends Gg3dObject implements IGg3dCamera {

  get supportsFov(): boolean {
    return this.nativeCamera instanceof PerspectiveCamera || this.nativeCamera.type == "PerspectiveCamera";
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
