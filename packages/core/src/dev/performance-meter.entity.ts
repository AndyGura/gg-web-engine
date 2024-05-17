import { GgWorld, IEntity, TickOrder } from '../base';
import { takeUntil } from 'rxjs';

export class PerformanceMeterEntity extends IEntity {
  readonly tickOrder: TickOrder | number = Number.MAX_SAFE_INTEGER;

  private sampleIndex = 0;
  private collectedData: Map<IEntity | 'PHYSICS_WORLD', [number, number, number][]> = new Map<
    IEntity,
    [number, number, number][]
  >();
  private _report: { totalTime: number; entries: [string, number][] } = { totalTime: 0, entries: [] };

  public get report(): { totalTime: number; entries: [string, number][] } {
    return this._report;
  }

  constructor(private readonly maxSamples = 30, private readonly maxRows = 15) {
    super();
  }

  onSpawned(world: GgWorld<unknown, unknown>) {
    super.onSpawned(world);
    this.sampleIndex = 0;
    const now = () => (typeof performance === 'undefined' ? Date : performance).now();
    this.world!.tickForwardTo$.pipe(takeUntil(this.onRemoved$)).subscribe(e => {
      if (e === this) return;
      if (!this.collectedData.has(e)) {
        this.collectedData.set(e, [[this.sampleIndex, now(), 0]]);
      } else {
        this.collectedData.get(e)!.push([this.sampleIndex, now(), 0]);
      }
    });
    this.world!.tickForwardedTo$.pipe(takeUntil(this.onRemoved$)).subscribe(e => {
      if (e === this) return;
      const report = this.collectedData.get(e)!;
      report[report.length - 1][2] = now();
    });
    this.tick$.pipe(takeUntil(this.onRemoved$)).subscribe(() => {
      this.sampleIndex++;
      // remove oldest samples
      const entries = Array.from(this.collectedData.entries());
      for (const [k, v] of entries) {
        while (v.length > 0 && v[0][0] < this.sampleIndex - this.maxSamples) {
          v.shift();
        }
        if (v.length === 0) {
          this.collectedData.delete(k);
        }
      }
      // build samples
      let totalTimeAvg = 0;
      let report = Array.from(this.collectedData.entries())
        .map(([e, samples]) => {
          let label = '';
          if (e instanceof IEntity) {
            label = e.name;
            if (e.name === '') {
              label = e.constructor.name;
            }
          } else if (e === 'PHYSICS_WORLD') {
            label = 'Physics simulation';
          } else {
            label = e;
          }
          const timeSpentAvg = samples.reduce((prev, [_, start, finish]) => prev + finish - start, 0) / this.maxSamples;
          totalTimeAvg += timeSpentAvg;
          return [label, timeSpentAvg] as [string, number];
        })
        .sort((a, b) => b[1] - a[1]);
      let restSum = 0;
      let restAmount = 0;
      for (restAmount; restAmount < report.length - 2; restAmount++) {
        if (this.maxRows > report.length - restAmount + 1) {
          restAmount--;
          break;
        }
        restSum += report[report.length - restAmount - 1][1];
      }
      if (restAmount > 1) {
        report = report.slice(0, report.length - restAmount);
        report.push([`Rest (${restAmount})`, restSum]);
      }
      this._report = { totalTime: totalTimeAvg, entries: report };
    });
  }

  onRemoved() {
    super.onRemoved();
    this.collectedData = new Map<IEntity | 'PHYSICS_WORLD', [number, number, number][]>();
    this._report = { totalTime: 0, entries: [] };
  }
}
