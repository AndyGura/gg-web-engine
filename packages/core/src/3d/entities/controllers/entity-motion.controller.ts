import { GgEntity } from '../../../base/entities/gg-entity';
import { ITickListener } from '../../../base/entities/interfaces/i-tick-listener';
import { BehaviorSubject, distinctUntilChanged, Observable, Subject, Subscription, takeUntil } from 'rxjs';
import { Gg3dWorld } from '../../gg-3d-world';
import { GgPositionable3dEntity } from '../gg-positionable-3d-entity';
import { Point3, Point4 } from '../../../base/models/points';
import { Pnt3 } from '../../../base/math/point3';
import { Qtrn } from '../../../base/math/quaternion';

export type MotionControlFuncReturn = { position: Point3; rotation: Point4; customParameters: { [key: string]: any } };
export type MotionControlFunction = (delta: number) => MotionControlFuncReturn;

export class EntityMotionController extends GgEntity implements ITickListener {
  public readonly tick$: Subject<[number, number]> = new Subject<[number, number]>();
  // after all object bindings to avoid visual jittering
  public readonly tickOrder: number = 800;

  get motionControlFunction(): MotionControlFunction {
    return this._motionControlFunction;
  }

  set motionControlFunction(value: MotionControlFunction) {
    if (this.currentTransition) {
      this.currentTransition.unsubscribe();
      this.currentTransition = null;
    }
    this._motionControlFunction = value;
  }

  protected readonly removed$: Subject<void> = new Subject<void>();

  protected lastValue: MotionControlFuncReturn | undefined;
  private _currentTransition: Subscription | null = null;

  protected get currentTransition(): Subscription | null {
    return this._currentTransition;
  }

  protected set currentTransition(value: Subscription | null) {
    this._currentTransition = value;
    this._isInTransition$.next(!!value);
  }

  private _isInTransition$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public get isInTransition$(): Observable<boolean> {
    return this._isInTransition$.pipe(distinctUntilChanged());
  }

  constructor(
    public target: GgPositionable3dEntity,
    protected _motionControlFunction: MotionControlFunction,
    public customParametersHandleFunc: (target: GgPositionable3dEntity, params: any) => void = () => {},
  ) {
    super();
  }

  // smoothly set controller function, animate from some determined state
  transitFromStaticState(
    state: MotionControlFuncReturn,
    newFunc: MotionControlFunction,
    transitionDuration: number,
    easing: (t: number) => number = x => x,
    customParametersLerpFunc: (a: any, b: any, t: number) => any = (a, b, t) => b,
  ) {
    this.lastValue = state;
    this._motionControlFunction = () => state;
    return this.transitControlFunction(newFunc, transitionDuration, easing, customParametersLerpFunc);
  }

  // smoothly change controller function
  transitControlFunction(
    newFunc: MotionControlFunction,
    transitionDuration: number,
    easing: (t: number) => number = x => x,
    customParametersLerpFunc: (a: any, b: any, t: number) => any = (a, b, t) => b,
  ) {
    let oldControlFunc: MotionControlFunction;
    if (this.currentTransition) {
      this.currentTransition.unsubscribe();
      this.currentTransition = null;
      if (this.lastValue) {
        oldControlFunc = () => this.lastValue!;
      } else {
        this._motionControlFunction = newFunc;
        return;
      }
    } else {
      oldControlFunc = this._motionControlFunction;
    }
    let k = 0;
    this._motionControlFunction = delta => {
      const oldRes = oldControlFunc(delta);
      const newRes = newFunc(delta);
      return {
        customParameters: customParametersLerpFunc(oldRes.customParameters, newRes.customParameters, k),
        position: Pnt3.lerp(oldRes.position, newRes.position, k),
        rotation: Qtrn.slerp(oldRes.rotation, newRes.rotation, k),
      };
    };
    let startTime: number | undefined;
    this.currentTransition = this.tick$.pipe(takeUntil(this.removed$)).subscribe(([elapsed, _]) => {
      if (startTime === undefined) {
        startTime = elapsed;
      } else {
        k = (elapsed - startTime) / transitionDuration;
        if (k >= 1) {
          k = 1;
          this.currentTransition!.unsubscribe();
          this.currentTransition = null;
          this._motionControlFunction = newFunc;
        } else {
          k = easing(k);
        }
      }
    });
  }

  onSpawned(world: Gg3dWorld) {
    super.onSpawned(world);
    this.tick$.pipe(takeUntil(this.removed$)).subscribe(([_, delta]) => {
      this.lastValue = this._motionControlFunction(delta);
      this.target.position = this.lastValue.position;
      this.target.rotation = this.lastValue.rotation;
      this.customParametersHandleFunc(this.target, this.lastValue.customParameters);
    });
  }

  onRemoved() {
    super.onRemoved();
    this.removed$.next();
  }

  dispose(): void {
    super.dispose();
    this.tick$.unsubscribe();
    this.tick$.complete();
  }
}
