import { GgEntity } from '../../base/entities/gg-entity';
import { Point2 } from '../../base/models/points';
import { BehaviorSubject, Observable } from 'rxjs';
import { Gg2dWorld } from '../gg-2d-world';

export abstract class GgPositionable2dEntity extends GgEntity {

  protected readonly _position$: BehaviorSubject<Point2> = new BehaviorSubject<Point2>({ x: 0, y: 0 });
  protected readonly _rotation$: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  protected readonly _scale$: BehaviorSubject<Point2> = new BehaviorSubject<Point2>({ x: 1, y: 1 });

  get world(): Gg2dWorld | null {
    return super.world;
  }

  public get position(): Point2 {
    return this._position$.getValue();
  }

  public get position$(): Observable<Point2> {
    return this._position$.asObservable();
  }

  public set position(value: Point2) {
    this._position$.next(value);
  }

  public get rotation(): number {
    return this._rotation$.getValue();
  }

  public get rotation$(): Observable<number> {
    return this._rotation$.asObservable();
  }

  public set rotation(value: number) {
    this._rotation$.next(value);
  }

  public get scale(): Point2 {
    return this._scale$.getValue();
  }

  public get scale$(): Observable<Point2> {
    return this._scale$.asObservable();
  }

  public set scale(value: Point2) {
    this._scale$.next(value);
  }

  onSpawned(world: Gg2dWorld) {
    super.onSpawned(world);
  }
}
