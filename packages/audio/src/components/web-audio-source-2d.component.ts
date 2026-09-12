import { AudioDistanceModel, AudioSourceDescriptor, IAudioSource2dComponent, Pnt2, Point2 } from '@gg-web-engine/core';
import { rampParam } from '../utils/ramp';
import { computeDistanceGain } from '../utils/distance-gain';
import { WebAudioSourceComponentBase } from './web-audio-source-base.component';
import { WebAudioScene2dComponent } from './web-audio-scene-2d.component';

/**
 * 2D audio source: `StereoPannerNode` (pan only, no native distance falloff) plus a manually
 * driven `GainNode` for distance attenuation - see `IAudioSource2dComponent`'s own doc. Position
 * is stored directly rather than pushed into an `AudioParam` on every write (there's no native
 * distance-aware node to push it into); `WebAudioScene2dComponent.update` reads it back once per
 * tick, via `applySpatialUpdate`, to recompute pan/gain against the current listener position.
 */
export class WebAudioSource2dComponent
  extends WebAudioSourceComponentBase<Point2, number>
  implements IAudioSource2dComponent
{
  private readonly panner: StereoPannerNode;
  private readonly distanceGain: GainNode;
  private _position: Point2 = Pnt2.O;
  private _rotation = 0;

  public refDistance = 1;
  public maxDistance = 10000;
  public rolloffFactor = 1;
  public distanceModel: AudioDistanceModel = 'linear';

  constructor(scene: WebAudioScene2dComponent, descriptor: AudioSourceDescriptor<AudioBuffer>) {
    super(scene, descriptor);
    this.panner = scene.context.createStereoPanner();
    this.distanceGain = scene.context.createGain();
    this.wireOutput();
  }

  protected wireOutput(): void {
    this.gainNode.disconnect();
    this.distanceGain.disconnect();
    this.panner.disconnect();
    if (this.spatial) {
      this.gainNode.connect(this.distanceGain);
      this.distanceGain.connect(this.panner);
      this.panner.connect(this.getBusNode());
    } else {
      this.gainNode.connect(this.getBusNode());
    }
  }

  protected disconnectSpatialNode(): void {
    this.distanceGain.disconnect();
    this.panner.disconnect();
  }

  public get position(): Point2 {
    return this._position;
  }

  public set position(value: Point2) {
    this._position = value;
  }

  public get rotation(): number {
    return this._rotation;
  }

  public set rotation(value: number) {
    this._rotation = value;
  }

  /**
   * Recomputes pan/distance-gain against `listenerPosition` - called once per
   * `IAudioSceneComponent.update` tick by `WebAudioScene2dComponent`, for every living spatial 2D
   * source. Not meant to be called by app code.
   */
  public applySpatialUpdate(listenerPosition: Point2): void {
    if (!this.spatial) {
      return;
    }
    const dx = this._position.x - listenerPosition.x;
    const dy = this._position.y - listenerPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const gain = computeDistanceGain(
      distance,
      this.refDistance,
      this.maxDistance,
      this.rolloffFactor,
      this.distanceModel,
    );
    // Pan is taken directly from the world-space horizontal offset, not rotated into the
    // listener's own facing direction - 2D worlds here are normally viewed straight-on (no
    // first-person notion of "which way the listener faces" the way a 3D camera has), so raw `dx`
    // reads correctly for the common top-down/side-scroller case.
    const panRange = Math.max(this.refDistance, 1);
    const pan = Math.max(-1, Math.min(1, dx / panRange));
    const ctx = this.scene.context;
    rampParam(ctx, this.distanceGain.gain, gain);
    rampParam(ctx, this.panner.pan, pan);
  }

  public clone(): WebAudioSource2dComponent {
    return new WebAudioSource2dComponent(this.scene as WebAudioScene2dComponent, {
      clip: this.clip,
      loop: this.loop,
      volume: this.volume,
      playbackRate: this.playbackRate,
      spatial: this.spatial,
      bus: this.bus,
      autoplay: false,
    });
  }
}
