import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { map, switchMap, takeUntil } from 'rxjs/operators';
import { BehaviorSubject, Observable, of, Subject, timer } from 'rxjs';
import { GgCarEntity } from '@gg-web-engine/core';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
// https://codepen.io/Chmood/pen/MaBZdM?editors=0100
export class DashboardComponent implements OnInit, OnDestroy {

  Math = Math;

  // margin for dials
  margin: number = 10;

  angleMin: number = 30;
  angleMax: number = 330;

  // tachometer
  maxRpm: number = 8000;
  rpmRedzone: number = 6500;
  tachometerStep: number = 1000;
  tachometerStepsCount: number = Math.round(this.maxRpm / this.tachometerStep);
  tachometerSteps: number[] = Array(this.tachometerStepsCount + 1)
    .fill(1)
    .map((x, i) => i);
  tachometerAngleStep: number = (this.angleMax - this.angleMin) / this.tachometerStepsCount;
  // speedometer
  maxSpeed: number = 320;
  speedometerStep: number = 20;
  speedometerStepsCount: number = Math.round(this.maxSpeed / this.speedometerStep);
  speedometerSteps: number[] = Array(this.speedometerStepsCount + 1)
    .fill(1)
    .map((x, i) => i);
  speedometerAngleStep: number = (this.angleMax - this.angleMin) / this.speedometerStepsCount;

  $currentRpm: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  $currentGear: BehaviorSubject<string> = new BehaviorSubject<string>('N');
  $currentSpeed: BehaviorSubject<number> = new BehaviorSubject<number>(0);

  destroyed$: Subject<void> = new Subject<void>();

  @Input()
  set car(v: GgCarEntity | null) {
    this.car$.next(v);
  }
  private car$: BehaviorSubject<GgCarEntity | null> = new BehaviorSubject<GgCarEntity | null>(null);

  constructor(
  ) {
  }

  ngOnInit() {
    this.car$
      .pipe(
        takeUntil(this.destroyed$),
        switchMap((car): Observable<[number, number, number, number]> => {
          return car
            ? timer(0, 20).pipe(map(() => [car.raycastVehicle.getSpeed() * 3.6, car.carProperties.engine.maxRpm, car.engineRpm, car.gear]))
            : of([0, 8000, 0, 0]);
        }),
      )
      .subscribe(([speed, maxRpm, engineRpm, gear]) => {
        this.$currentRpm.next(engineRpm);
        this.$currentGear.next(gear > 0 ? gear.toString() : (gear < 0 ? 'R' : 'N'));
        this.$currentSpeed.next(Math.abs(speed));
        this.maxRpm = maxRpm;
      });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }


  getAngleForRpm(rpm: number | null): number {
    return ((rpm || 0) / this.maxRpm) * (this.angleMax - this.angleMin) + this.angleMin;
  }

  getAngleForSpeed(speed: number | null): number {
    return ((speed || 0) / this.maxSpeed) * (this.angleMax - this.angleMin) + this.angleMin;
  }

}


