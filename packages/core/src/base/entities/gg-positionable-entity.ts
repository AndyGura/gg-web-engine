import { BehaviorSubject, Observable } from 'rxjs';
import { GgEntity } from './gg-entity';
import { GgWorld } from '../gg-world';

export abstract class GgPositionableEntity<D, R> extends GgEntity {

  protected readonly _position$: BehaviorSubject<D>;
  protected readonly _rotation$: BehaviorSubject<R>;
  protected readonly _scale$: BehaviorSubject<D>;

  abstract getDefaultPosition(): D;
  abstract getDefaultRotation(): R;
  abstract getDefaultScale(): D;

  get world(): GgWorld<D, R> | null {
    return super.world;
  }

  public get position(): D {
    return this._position$.getValue();
  }

  public get position$(): Observable<D> {
    return this._position$.asObservable();
  }

  public set position(value: D) {
    this._position$.next(value);
  }

  public get rotation(): R {
    return this._rotation$.getValue();
  }

  public get rotation$(): Observable<R> {
    return this._rotation$.asObservable();
  }

  public set rotation(value: R) {
    this._rotation$.next(value);
  }

  public get scale(): D {
    return this._scale$.getValue();
  }

  public get scale$(): Observable<D> {
    return this._scale$.asObservable();
  }

  public set scale(value: D) {
    this._scale$.next(value);
  }

  protected constructor() {
    super();
    this._position$ = new BehaviorSubject<D>(this.getDefaultPosition());
    this._rotation$ = new BehaviorSubject<R>(this.getDefaultRotation());
    this._scale$ = new BehaviorSubject<D>(this.getDefaultScale());
  }

  onSpawned(world: GgWorld<D, R>) {
    super.onSpawned(world);
  }
}
