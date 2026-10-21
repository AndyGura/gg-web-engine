import { IPositionable, Pnt3, Point3, Point4 } from '../../../base';
import { Camera3dEntity } from '../../entities/camera-3d.entity';

/**
 * Which local axes of a 3D audio listener's rotation are its "forward" and "up" - the two local
 * conventions this Z-up engine uses:
 * - `'camera'`: forward is local -Z (`Pnt3.nZ`), up is local +Y (`Pnt3.Y`) - the three.js camera
 *   convention every camera here follows (`Qtrn.lookAt` puts the world's `Pnt3.Z` on a camera's
 *   local +Y; `FreeCameraController` reads local -Z as its look direction).
 * - `'body'`: forward is local +Y (`Pnt3.Y`), up is local +Z (`Pnt3.Z`) - every other entity
 *   (`RaycastVehicle3dEntity`/`GgCarEntity`, `CharacterController3dEntity`), so an upright body with
 *   the identity rotation faces +Y with its head along world up.
 *
 * See {@link AUDIO_LISTENER_AXES} for the vectors and {@link defaultAudioListenerBasis} for which
 * one `IAudioScene3dComponent.setActiveListener` picks when none is given.
 */
export type AudioListenerBasis = 'camera' | 'body';

/** Local forward/up unit vectors of each {@link AudioListenerBasis}, always perpendicular. */
export const AUDIO_LISTENER_AXES: Readonly<Record<AudioListenerBasis, { forward: Point3; up: Point3 }>> = {
  camera: { forward: Pnt3.nZ, up: Pnt3.Y },
  body: { forward: Pnt3.Y, up: Pnt3.Z },
};

/**
 * `'camera'` for a `Camera3dEntity` (what `GgWorld` binds a renderer's camera as) or a bare camera
 * component (anything with a `fov`, i.e. an `ICamera3dComponent`), `'body'` for anything else.
 */
export function defaultAudioListenerBasis(target: IPositionable<Point3, Point4>): AudioListenerBasis {
  return target instanceof Camera3dEntity || 'fov' in target ? 'camera' : 'body';
}
