import {
  AUDIO_LISTENER_AXES,
  AudioOneShotDescriptor,
  AudioListenerBasis,
  AudioPanningModel,
  defaultAudioListenerBasis,
  IAudioScene3dComponent,
  IPositionable,
  playAudioOneShot,
  Pnt3,
  Point3,
  Point4,
} from '@gg-web-engine/core';
import { DEFAULT_RAMP_TAU, rampParam, setParamNow } from '../utils/ramp';
import { WebAudioSceneComponentBase, WebAudioSceneOptions } from './web-audio-scene-base.component';
import { WebAudioSource3dComponentFactory } from '../web-audio-factory';
import { WebAudioSource3dComponent } from './web-audio-source-3d.component';

/**
 * 3D `IAudioSceneComponent`: every source gets a real `PannerNode` (native distance/cone
 * spatialization), so `update()` only has to keep the native `AudioListener` in sync with
 * whatever `activeListener` is set to, read with `activeListenerBasis`'s local axes - no manual
 * per-source pan/gain work like the 2D implementation needs.
 *
 * On a shared `AudioContext` (`WebAudioSceneOptions.context`) the native listener is shared too -
 * there is one per context. A scene writes it only from `update()` and only while it has an active
 * listener, whether or not it owns the context, so give one scene on a context the active listener
 * at a time: a world's scene (the world binds its camera) next to an app's menu scene that no world
 * updates (no positional sources) never fight over it, whereas two updated scenes with active
 * listeners would overwrite each other every frame. A scene's first write after it gets a listener
 * is a cut to it, not a sweep from wherever the listener was, and disposing a scene leaves the
 * native listener as it is.
 */
export class WebAudioScene3dComponent
  extends WebAudioSceneComponentBase<Point3, Point4>
  implements IAudioScene3dComponent
{
  public readonly backendName: string = 'webaudio';

  public readonly factory: WebAudioSource3dComponentFactory;

  /**
   * `PannerNode.panningModel` for every source created from now on whose descriptor sets none.
   * `'HRTF'` by default; `'equalpower'` is far cheaper on the audio thread (see
   * `AudioPanningModel`). Existing sources keep theirs.
   */
  public defaultPanningModel: AudioPanningModel = 'HRTF';

  private _activeListenerBasis: AudioListenerBasis = 'camera';

  /** What `syncListener` last sent to the native listener; `null` until the first sync after a
   * listener change. */
  private listenerState: ListenerState | null = null;

  /**
   * @param options `context`: an existing `AudioContext` to build the scene on instead of creating
   * one - see `WebAudioSceneOptions`.
   */
  constructor(options: WebAudioSceneOptions = {}) {
    super(options);
    this.factory = new WebAudioSource3dComponentFactory(this);
  }

  /** See `IAudioSceneComponent.playOneShot` - a non-positional source from this scene's factory. */
  public playOneShot(descriptor: AudioOneShotDescriptor<AudioBuffer>): WebAudioSource3dComponent {
    return playAudioOneShot(this.factory, descriptor);
  }

  public update(_elapsed: number, _delta: number): void {
    this.syncListener();
    this.updateVoices();
    this.updateReverbs();
  }

  public get activeListenerBasis(): AudioListenerBasis {
    return this._activeListenerBasis;
  }

  public setActiveListener(target: IPositionable<Point3, Point4> | null, basis?: AudioListenerBasis): void {
    const resolvedBasis = basis ?? (target ? defaultAudioListenerBasis(target) : this._activeListenerBasis);
    if (target !== this.activeListener || resolvedBasis !== this._activeListenerBasis) {
      // the next sync is a cut to the new ears, not a sweep from the old ones
      this.listenerState = null;
    }
    super.setActiveListener(target);
    this._activeListenerBasis = resolvedBasis;
  }

  private syncListener(): void {
    const listener = this.activeListener;
    if (!listener) {
      return;
    }
    const ctx = this.context;
    const now = ctx.currentTime;
    // Forward and up are always perpendicular (see AUDIO_LISTENER_AXES): a degenerate orientation
    // (up parallel to forward) has no left/right, so every PannerNode pans meaninglessly, and iOS
    // Safari renders every positional source as broken, pitch-garbled audio while these params are
    // under automation (ramped every tick, so always).
    const axes = AUDIO_LISTENER_AXES[this._activeListenerBasis];
    const next: ListenerFrame = {
      position: listener.position,
      forward: Pnt3.rot(axes.forward, listener.rotation),
      up: Pnt3.rot(axes.up, listener.rotation),
    };
    const previous = this.listenerState;
    // where the native listener is now: how far `setTargetAtTime` has taken it towards the last
    // target since then
    const heard = previous
      ? lerpFrame(previous.heard, previous.target, 1 - Math.exp(-(now - previous.time) / DEFAULT_RAMP_TAU))
      : null;
    const turnTooLarge =
      !heard ||
      Pnt3.angle(heard.forward, next.forward) > MAX_EASED_TURN ||
      Pnt3.angle(heard.up, next.up) > MAX_EASED_TURN;
    const written: ListenerFrame = {
      position: heard ? heard.position : next.position,
      forward: turnTooLarge ? next.forward : heard.forward,
      up: turnTooLarge ? next.up : heard.up,
    };
    this.listenerState = { time: now, target: next, heard: written };
    const nativeListener = ctx.listener;
    if (nativeListener.positionX) {
      const writePosition = heard ? rampParam : setParamNow;
      const writeOrientation = turnTooLarge ? setParamNow : rampParam;
      writePosition(ctx, nativeListener.positionX, next.position.x);
      writePosition(ctx, nativeListener.positionY, next.position.y);
      writePosition(ctx, nativeListener.positionZ, next.position.z);
      writeOrientation(ctx, nativeListener.forwardX, next.forward.x);
      writeOrientation(ctx, nativeListener.forwardY, next.forward.y);
      writeOrientation(ctx, nativeListener.forwardZ, next.forward.z);
      writeOrientation(ctx, nativeListener.upX, next.up.x);
      writeOrientation(ctx, nativeListener.upY, next.up.y);
      writeOrientation(ctx, nativeListener.upZ, next.up.z);
    } else {
      // Firefox and older Safari: no AudioParam-based listener, only the legacy methods, which
      // apply at once. Write where a `setTargetAtTime` ramp would have taken the listener by now
      // (`written`), so it eases in on the main thread instead of snapping every tick.
      const { position, forward, up } = written;
      nativeListener.setPosition(position.x, position.y, position.z);
      nativeListener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }
}

/**
 * Largest change of the listener's forward or up direction, in radians, that `syncListener` eases
 * in. Easing moves each component on its own (`setTargetAtTime` per param), so forward and up travel
 * the straight line between where the listener is and where it goes: across a turn near 180° (a
 * camera cut, a snap turn) they shrink towards zero length midway - an orientation with no
 * left/right. A larger turn jumps instead (`setParamNow`); at 90° both keep over 70% of their
 * length along the way.
 */
const MAX_EASED_TURN = Math.PI / 2;

interface ListenerFrame {
  position: Point3;
  forward: Point3;
  up: Point3;
}

interface ListenerState {
  /** context time of the last sync */
  time: number;
  /** what the native listener is easing towards since `time` */
  target: ListenerFrame;
  /** where the native listener was at `time` */
  heard: ListenerFrame;
}

function lerpFrame(a: ListenerFrame, b: ListenerFrame, t: number): ListenerFrame {
  return {
    position: Pnt3.lerp(a.position, b.position, t),
    forward: Pnt3.lerp(a.forward, b.forward, t),
    up: Pnt3.lerp(a.up, b.up, t),
  };
}
