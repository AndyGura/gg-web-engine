import { GgWorld, IEntity, TickOrder } from '../base';
import { takeUntil } from 'rxjs';

export class PerformanceMeterEntity extends IEntity {
  readonly tickOrder: TickOrder | number = Number.MAX_SAFE_INTEGER;

  private sampleIndex = 0;
  private collectedData: Map<IEntity | 'PHYSICS_WORLD', [number, number, number][]> = new Map<
    IEntity,
    [number, number, number][]
  >();

  private _avgReport: { totalTime: number; entries: [string, number][] } = { totalTime: 0, entries: [] };
  public get avgReport(): { totalTime: number; entries: [string, number][] } {
    return this._avgReport;
  }

  private _peakReport: { totalTime: number; entries: [string, number][] } = { totalTime: 0, entries: [] };
  public get peakReport(): { totalTime: number; entries: [string, number][] } {
    return this._peakReport;
  }

  constructor(
    private readonly maxSamples = 60,
    private readonly maxRows = 15,
  ) {
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

      // helper functions
      const label = (e: IEntity | string) => {
        if (e instanceof IEntity) {
          if (e.name === '') {
            return e.constructor.name;
          } else {
            return e.name;
          }
        } else if (e === 'PHYSICS_WORLD') {
          return 'Physics simulation';
        } else {
          return e;
        }
      };
      const truncateReport = (report: [string, number][]) => {
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
        return report;
      };

      // build avg report
      let totalTimeAvg = 0;
      let avgReport = Array.from(this.collectedData.entries())
        .map(([e, samples]) => {
          const timeSpentAvg = samples.reduce((prev, [_, start, finish]) => prev + finish - start, 0) / this.maxSamples;
          totalTimeAvg += timeSpentAvg;
          return [label(e), timeSpentAvg] as [string, number];
        })
        .sort((a, b) => b[1] - a[1]);
      avgReport = truncateReport(avgReport);
      this._avgReport = { totalTime: totalTimeAvg, entries: avgReport };

      // build peak report
      let totalTimePeaks: Map<number, number> = new Map();
      let peakReport = Array.from(this.collectedData.entries())
        .map(([e, samples]) => {
          let peakTime = 0;
          for (const [sample, start, finish] of samples) {
            const time = finish - start;
            peakTime = Math.max(peakTime, time);
            totalTimePeaks.set(sample, time + (totalTimePeaks.get(sample) || 0));
          }
          return [label(e), peakTime] as [string, number];
        })
        .sort((a, b) => b[1] - a[1]);
      peakReport = truncateReport(peakReport);
      let totalPeak = Array.from(totalTimePeaks.values()).reduce((prev, cur) => Math.max(prev, cur), 0);
      this._peakReport = { totalTime: totalPeak, entries: peakReport };
    });
  }

  onRemoved() {
    super.onRemoved();
    this.collectedData = new Map<IEntity | 'PHYSICS_WORLD', [number, number, number][]>();
    this._avgReport = { totalTime: 0, entries: [] };
    this._peakReport = { totalTime: 0, entries: [] };
  }
}
