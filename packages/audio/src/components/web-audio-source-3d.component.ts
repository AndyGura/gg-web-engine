import {
  AudioDistanceModel,
  AudioPanningModel,
  AudioSource3dDescriptor,
  IAudioSource3dComponent,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
} from '@gg-web-engine/core';
import { rampParam, setParamNow } from '../utils/ramp';
import { computeDistanceGain } from '../utils/distance-gain';
import { WebAudioSourceComponentBase } from './web-audio-source-base.component';
import { WebAudioScene3dComponent } from './web-audio-scene-3d.component';

/**
 * 3D audio source: a `PannerNode` for full positional spatialization (distance rolloff + a
 * directional cone), native to the Web Audio API - no manual pan/gain math needed here, unlike
 * the 2D counterpart. `distanceModel` defaults to `'linear'` (not the Web Audio default,
 * `'inverse'`) and `refDistance` to `1` - see `IAudioSource3dComponent`'s own doc for why.
 * `panningModel` defaults to the scene's `defaultPanningModel` (`'HRTF'` unless changed).
 */
export class WebAudioSource3dComponent
  extends WebAudioSourceComponentBase<Point3, Point4>
  implements IAudioSource3dComponent
{
  private readonly panner: PannerNode;
  private _position: Point3 = Pnt3.O;
  private _rotation: Point4 = Qtrn.O;

  constructor(scene: WebAudioScene3dComponent, descriptor: AudioSource3dDescriptor<AudioBuffer>) {
    super(scene, descriptor);
    this.panner = scene.context.createPanner();
    this.panner.panningModel = descriptor.panningModel ?? scene.defaultPanningModel;
    this.panner.distanceModel = 'linear';
    this.panner.refDistance = 1;
    this.panner.maxDistance = 10000;
    this.panner.rolloffFactor = 1;
    this.panner.coneInnerAngle = 360;
    this.panner.coneOuterAngle = 360;
    this.panner.coneOuterGain = 0;
    this.wireOutput();
  }

  protected wireOutput(): void {
    this.gainNode.disconnect();
    this.panner.disconnect();
    if (this.spatial) {
      this.gainNode.connect(this.panner);
      this.panner.connect(this.getBusNode());
    } else {
      this.gainNode.connect(this.getBusNode());
    }
  }

  protected disconnectSpatialNode(): void {
    this.panner.disconnect();
  }

  public get position(): Point3 {
    return this._position;
  }

  public set position(value: Point3) {
    this._position = value;
    if (this.isOutputConnected) {
      this.writePosition(rampParam);
    }
  }

  private writePosition(write: typeof rampParam): void {
    const value = this._position;
    const ctx = this.scene.context;
    if (this.panner.positionX) {
      write(ctx, this.panner.positionX, value.x);
      write(ctx, this.panner.positionY, value.y);
      write(ctx, this.panner.positionZ, value.z);
    } else {
      // Safari < 17 / very old browsers: no AudioParam-based position, only the legacy method
      this.panner.setPosition(value.x, value.y, value.z);
    }
  }

  public get rotation(): Point4 {
    return this._rotation;
  }

  public set rotation(value: Point4) {
    this._rotation = value;
    if (this.isOutputConnected) {
      this.writeOrientation(rampParam);
    }
  }

  private writeOrientation(write: typeof rampParam): void {
    // Local "forward" is -Z, matching every other camera-facing controller in this engine (see
    // FreeCameraController/PlayerCharacterController's own use of `Pnt3.rot(Pnt3.nZ, rotation)`
    // for the same reason) - only the cone's own axis needs this, PannerNode has no listener-style
    // "up" field for a source.
    const forward = Pnt3.rot(Pnt3.nZ, this._rotation);
    const ctx = this.scene.context;
    if (this.panner.orientationX) {
      write(ctx, this.panner.orientationX, forward.x);
      write(ctx, this.panner.orientationY, forward.y);
      write(ctx, this.panner.orientationZ, forward.z);
    } else {
      this.panner.setOrientation(forward.x, forward.y, forward.z);
    }
  }

  protected resyncSpatialParams(): void {
    this.writePosition(setParamNow);
    this.writeOrientation(setParamNow);
  }

  protected distanceGainAt(listenerPosition: Point3): number {
    return computeDistanceGain(
      Pnt3.dist(this._position, listenerPosition),
      this.panner.refDistance,
      this.panner.maxDistance,
      this.panner.rolloffFactor,
      this.panner.distanceModel,
    );
  }

  public get panningModel(): AudioPanningModel {
    return this.panner.panningModel;
  }

  public set panningModel(value: AudioPanningModel) {
    this.panner.panningModel = value;
  }

  public get refDistance(): number {
    return this.panner.refDistance;
  }

  public set refDistance(value: number) {
    this.panner.refDistance = value;
  }

  public get maxDistance(): number {
    return this.panner.maxDistance;
  }

  public set maxDistance(value: number) {
    this.panner.maxDistance = value;
  }

  public get rolloffFactor(): number {
    return this.panner.rolloffFactor;
  }

  public set rolloffFactor(value: number) {
    this.panner.rolloffFactor = value;
  }

  public get distanceModel(): AudioDistanceModel {
    return this.panner.distanceModel;
  }

  public set distanceModel(value: AudioDistanceModel) {
    this.panner.distanceModel = value;
  }

  public get coneInnerAngle(): number {
    return this.panner.coneInnerAngle;
  }

  public set coneInnerAngle(value: number) {
    this.panner.coneInnerAngle = value;
  }

  public get coneOuterAngle(): number {
    return this.panner.coneOuterAngle;
  }

  public set coneOuterAngle(value: number) {
    this.panner.coneOuterAngle = value;
  }

  public get coneOuterGain(): number {
    return this.panner.coneOuterGain;
  }

  public set coneOuterGain(value: number) {
    this.panner.coneOuterGain = value;
  }

  public clone(): WebAudioSource3dComponent {
    return new WebAudioSource3dComponent(this.scene as WebAudioScene3dComponent, {
      clip: this.clip,
      loop: this.loop,
      loopStart: this.loopStart,
      loopEnd: this.loopEnd,
      volume: this.volume,
      playbackRate: this.playbackRate,
      spatial: this.spatial,
      bus: this.bus,
      priority: this.priority,
      panningModel: this.panningModel,
      autoplay: false,
    });
  }
}
