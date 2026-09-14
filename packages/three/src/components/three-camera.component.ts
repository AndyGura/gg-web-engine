import { ICamera3dComponent } from '@gg-web-engine/core';
import { Camera, PerspectiveCamera } from 'three';
import { ThreeDisplayObjectComponent } from './three-display-object.component';
import { ThreeVisualTypeDocRepo } from '../types';

export class ThreeCameraComponent
  extends ThreeDisplayObjectComponent
  implements ICamera3dComponent<ThreeVisualTypeDocRepo>
{
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
    // See `ICamera3dComponent`'s own doc: a camera renders every render layer by default, not just
    // `MAIN_RENDER_LAYER` the way a fresh three.js `Camera`'s own native `layers.mask` (and every
    // other, non-camera `ThreeDisplayObjectComponent`) defaults to - so a newly-placed camera never
    // has to be told about a layer some unrelated system already registered/enabled.
    nativeCamera.layers.enableAll();
  }
}
