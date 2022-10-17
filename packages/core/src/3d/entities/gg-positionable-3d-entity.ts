import { GgEntity } from '../../base/entities/gg-entity';
import { Point3, Point4 } from '../../base/models/points';
import { BehaviorSubject, Observable } from 'rxjs';
import { Gg3dWorld } from '../gg-3d-world';

export abstract class GgPositionable3dEntity extends GgEntity {

  protected readonly _position$: BehaviorSubject<Point3> = new BehaviorSubject<Point3>({ x: 0, y: 0, z: 0 });
  protected readonly _quaternion$: BehaviorSubject<Point4> = new BehaviorSubject<Point4>({ x: 0, y: 0, z: 0, w: 1 });
  protected readonly _scale$: BehaviorSubject<Point3> = new BehaviorSubject<Point3>({ x: 1, y: 1, z: 1 });

  get world(): Gg3dWorld | null {
    return super.world;
  }

  public get position(): Point3 {
    return this._position$.getValue();
  }

  public get position$(): Observable<Point3> {
    return this._position$.asObservable();
  }

  public set position(value: Point3) {
    this._position$.next(value);
  }

  public get rotation(): Point3 {
    // TODO quaternion -> euler
    return this.quaternion;
  }

  public get rotation$(): Observable<Point3> {
    // TODO quaternion -> euler
    return this.quaternion$;
  }

  public set rotation(value: Point3) {
    // TODO euler -> quaternion
    this.quaternion = { ...value, w: 1 };
  }

  public get quaternion(): Point4 {
    return this._quaternion$.getValue();
  }

  public get quaternion$(): Observable<Point4> {
    return this._quaternion$.asObservable();
  }

  public set quaternion(value: Point4) {
    this._quaternion$.next(value);
  }

  public get scale(): Point3 {
    return this._scale$.getValue();
  }

  public get scale$(): Observable<Point3> {
    return this._scale$.asObservable();
  }

  public set scale(value: Point3) {
    this._scale$.next(value);
  }

  onSpawned(world: Gg3dWorld) {
    super.onSpawned(world);
  }
}
