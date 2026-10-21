import { IAudioSceneComponent, IPositionable, Point3, Point4 } from '../../../base';
import { AudioTypeDocRepo3D } from '../../gg-3d-world';
import { AudioPanningModel } from './i-audio-source-3d.component';
import { AudioListenerBasis } from './audio-listener-basis';

export interface IAudioScene3dComponent<
  ATypeDoc extends AudioTypeDocRepo3D = AudioTypeDocRepo3D,
> extends IAudioSceneComponent<Point3, Point4, ATypeDoc> {
  /**
   * Panning model given to every 3D source created from now on whose descriptor sets none
   * (`AudioSource3dDescriptor.panningModel`). Defaults to `'HRTF'`. Set it once at startup, e.g. to
   * `'equalpower'` on mobile, to switch a whole game over in one place; sources that already exist
   * keep theirs (`IAudioSource3dComponent.panningModel` changes one).
   */
  defaultPanningModel: AudioPanningModel;

  /** Which local axes of `activeListener`'s rotation are read as its forward/up - see {@link AudioListenerBasis}. */
  readonly activeListenerBasis: AudioListenerBasis;

  /**
   * Makes `target` the listener, its rotation read with `basis`'s local axes. Without `basis`, a
   * camera is read as `'camera'` and anything else as `'body'` (`defaultAudioListenerBasis`), so a
   * renderer's camera and an upright player body both face where they look.
   */
  setActiveListener(target: IPositionable<Point3, Point4> | null, basis?: AudioListenerBasis): void;
}
