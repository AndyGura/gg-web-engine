import { Point3, Point4 } from '../../base/models/points';
import { Observable } from 'rxjs';
import { GgPositionableEntity } from '../../base/entities/gg-positionable-entity';
import { map } from 'rxjs/operators';
import { Qtrn } from '../../base/math/quaternion';
import { Pnt3 } from '../../base/math/point3';

export abstract class GgPositionable3dEntity extends GgPositionableEntity<Point3, Point4> {
  getDefaultPosition(): Point3 {
    return Pnt3.O;
  }

  getDefaultRotation(): Point4 {
    return Qtrn.O;
  }

  getDefaultScale(): Point3 {
    return { x: 1, y: 1, z: 1 };
  }

  public get euler$(): Observable<Point3> {
    return this._rotation$.pipe(map(q => Qtrn.toEuler(q)));
  }

  public get euler(): Point3 {
    return Qtrn.toEuler(this._rotation$.getValue());
  }

  public set euler(value: Point3) {
    this._rotation$.next(Qtrn.fromEuler(value));
  }
}
