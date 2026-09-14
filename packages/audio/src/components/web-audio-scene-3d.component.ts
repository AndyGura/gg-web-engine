import { IAudioScene3dComponent, Pnt3, Point3, Point4 } from '@gg-web-engine/core';
import { rampParam } from '../utils/ramp';
import { WebAudioSceneComponentBase } from './web-audio-scene-base.component';
import { WebAudioSource3dComponentFactory } from '../web-audio-factory';

/**
 * 3D `IAudioSceneComponent`: every source gets a real `PannerNode` (native distance/cone
 * spatialization), so `update()` only has to keep the native `AudioListener` in sync with
 * whatever `activeListener` is set to - no manual per-source pan/gain work like the 2D
 * implementation needs.
 */
export class WebAudioScene3dComponent
  extends WebAudioSceneComponentBase<Point3, Point4>
  implements IAudioScene3dComponent
{
  public readonly factory: WebAudioSource3dComponentFactory;

  constructor() {
    super();
    this.factory = new WebAudioSource3dComponentFactory(this);
  }

  public update(_elapsed: number, _delta: number): void {
    const listener = this.activeListener;
    if (!listener) {
      return;
    }
    const ctx = this.context;
    const nativeListener = ctx.listener;
    const position = listener.position;
    // Same local-forward/up convention as WebAudioSource3dComponent.rotation - see that class's
    // own comment for why this is Pnt3.nZ/Pnt3.Z rather than some other axis pair.
    const forward = Pnt3.rot(Pnt3.nZ, listener.rotation);
    const up = Pnt3.rot(Pnt3.Z, listener.rotation);
    if (nativeListener.positionX) {
      rampParam(ctx, nativeListener.positionX, position.x);
      rampParam(ctx, nativeListener.positionY, position.y);
      rampParam(ctx, nativeListener.positionZ, position.z);
      rampParam(ctx, nativeListener.forwardX, forward.x);
      rampParam(ctx, nativeListener.forwardY, forward.y);
      rampParam(ctx, nativeListener.forwardZ, forward.z);
      rampParam(ctx, nativeListener.upX, up.x);
      rampParam(ctx, nativeListener.upY, up.y);
      rampParam(ctx, nativeListener.upZ, up.z);
    } else {
      // Safari < 17 / very old browsers: no AudioParam-based listener, only the legacy methods
      nativeListener.setPosition(position.x, position.y, position.z);
      nativeListener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }
}
