import { Point3, Point4 } from '../../base/models/points';
import { Observable } from 'rxjs';
import { GgPositionableEntity } from '../../base/entities/gg-positionable-entity';

export abstract class GgPositionable3dEntity extends GgPositionableEntity<Point3, Point4> {

  getDefaultPosition(): Point3 {
    return { x: 0, y: 0, z: 0 };
  }

  getDefaultRotation(): Point4 {
    return { x: 0, y: 0, z: 0, w: 1 };
  }

  getDefaultScale(): Point3 {
    return { x: 1, y: 1, z: 1 };
  }

  public get euler$(): Observable<Point3> {
    // TODO quaternion -> euler
    return this._rotation$.asObservable();
  }

  public get euler(): Point3 {
    // TODO quaternion -> euler
    return this._rotation$.getValue();
  }

  public set euler(value: Point3) {
    // TODO euler -> quaternion
    this._rotation$.next({ ...value, w: 1 });
  }
}
