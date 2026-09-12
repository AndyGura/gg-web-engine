import { IAudioScene2dComponent, Point2 } from '@gg-web-engine/core';
import { WebAudioSceneComponentBase } from './web-audio-scene-base.component';
import { WebAudioSource2dComponent } from './web-audio-source-2d.component';
import { WebAudioSource2dComponentFactory } from '../web-audio-factory';

/**
 * 2D `IAudioSceneComponent`: since `StereoPannerNode` has no native distance model, `update()`
 * recomputes pan/gain for every living spatial source against the current `activeListener`
 * position each tick, on top of the base class's shared context/bus/clip-cache machinery.
 */
export class WebAudioScene2dComponent
  extends WebAudioSceneComponentBase<Point2, number>
  implements IAudioScene2dComponent
{
  public readonly factory: WebAudioSource2dComponentFactory;

  constructor() {
    super();
    this.factory = new WebAudioSource2dComponentFactory(this);
  }

  public update(_elapsed: number, _delta: number): void {
    const listener = this.activeListener;
    if (!listener) {
      return;
    }
    for (const source of this.livingSources) {
      (source as WebAudioSource2dComponent).applySpatialUpdate(listener.position);
    }
  }
}
