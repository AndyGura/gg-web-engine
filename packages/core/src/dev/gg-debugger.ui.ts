import { createInlineTickController, GgWorld, IRendererEntity } from '../base';
import { animationFrameScheduler, fromEvent, of, Subject, takeUntil } from 'rxjs';
import Stats from 'stats.js';
import { repeat } from 'rxjs/operators';
import { PerformanceMeterEntity } from './performance-meter.entity';

type RuntimeDataSnapshot = {
  readonly timeScale: number;
  readonly renderers: {
    readonly name: string;
    readonly entity: IRendererEntity<unknown, unknown>;
    readonly physicsDebugViewActive: boolean;
  }[];
  readonly performanceStatsEnabled: boolean;
};

type PerformanceStatsSnapshot = {
  readonly totalTime: number;
  readonly entries: [string, number][];
} | null;

const snapshotEqual = (a: RuntimeDataSnapshot, b: RuntimeDataSnapshot): boolean => {
  if (a.timeScale !== b.timeScale) return false;
  if (a.performanceStatsEnabled !== b.performanceStatsEnabled) return false;
  if (a.renderers.length !== b.renderers.length) return false;
  for (let i = 0; i < a.renderers.length; i++) {
    if (a.renderers[i].name !== b.renderers[i].name) return false;
    if (a.renderers[i].entity !== b.renderers[i].entity) return false;
    if (a.renderers[i].physicsDebugViewActive !== b.renderers[i].physicsDebugViewActive) return false;
  }
  return true;
};
const performanceStatsSnapshotEqual = (a: PerformanceStatsSnapshot, b: PerformanceStatsSnapshot): boolean => {
  if (!!a !== !!b) return false;
  if (a && b) {
    if (a.totalTime !== b.totalTime) return false;
    if (a.entries.length !== b.entries.length) return false;
    for (let i = 0; i < a.entries.length; i++) {
      if (a.entries[i][0] !== b.entries[i][0]) return false;
      if (a.entries[i][1] !== b.entries[i][1]) return false;
    }
  }
  return true;
};

export class GgDebuggerUI {
  private ui: {
    stats: Stats | null;
    debugControlsContainer: HTMLDivElement | null;
  } = {
    stats: null,
    debugControlsContainer: null,
  };

  private statsRemoved$: Subject<void> = new Subject<void>();

  public get showStats(): boolean {
    return !!this.ui.stats;
  }

  private currentWorld: GgWorld<any, any> | null = null;

  public setShowStats(selectedWorld: GgWorld<any, any> | null, value: boolean) {
    if (value === this.showStats) {
      if (value && this.currentWorld !== selectedWorld) {
        this.setShowStats(this.currentWorld, false);
      } else {
        return;
      }
    }
    this.currentWorld = selectedWorld;
    if (selectedWorld && value) {
      const stats = new Stats();
      this.ui.stats = stats;
      stats.dom.style.left = 'unset';
      stats.dom.style.right = '0';
      stats.showPanel(0); // 0: fps, 1: ms, 2: mb
      document.body.appendChild(stats.dom);
      createInlineTickController(selectedWorld, -1, 'fps_meter_init')
        .pipe(takeUntil(this.statsRemoved$))
        .subscribe(() => {
          stats?.begin();
        });
      createInlineTickController(selectedWorld, 10000, 'fps_meter')
        .pipe(takeUntil(this.statsRemoved$))
        .subscribe(() => {
          stats?.end();
        });
    } else {
      this.statsRemoved$.next();
      document.body.removeChild(this.ui.stats!.dom);
      this.ui.stats!.end();
      this.ui.stats = null;
    }
  }

  private debugControlsRemoved$: Subject<void> = new Subject<void>();
  private viewUpdated$: Subject<void> = new Subject<void>();

  public get showDebugControls(): boolean {
    return !!this.ui.debugControlsContainer;
  }

  public setShowDebugControls(selectedWorld: GgWorld<any, any> | null, value: boolean) {
    if (value === this.showDebugControls) {
      if (value && this.currentWorld !== selectedWorld) {
        this.setShowDebugControls(this.currentWorld, false);
      } else {
        return;
      }
    }
    this.currentWorld = selectedWorld;
    if (value) {
      const debugControlsContainer: HTMLDivElement = document.createElement('div');
      document.body.appendChild(debugControlsContainer);
      this.ui.debugControlsContainer = debugControlsContainer;
      debugControlsContainer.style.cssText =
        'position:fixed;top:48px;right:0;opacity:0.9;z-index:9999;background-color:#333;color:white;display:flex;flex-direction:column';
      this.snapshot = this.makeSnapshot();
      this.performanceStatsSnapshot = this.makePerformanceStatsSnapshot();
      this.renderControls(debugControlsContainer);
      this.renderPerformanceStats();
      of(undefined, animationFrameScheduler)
        .pipe(repeat(), takeUntil(this.debugControlsRemoved$))
        .subscribe(() => {
          const newSnapshot = this.makeSnapshot();
          if (!snapshotEqual(this.snapshot, newSnapshot)) {
            this.snapshot = newSnapshot;
            this.renderControls(debugControlsContainer);
          }
          const newPerformanceStats = this.makePerformanceStatsSnapshot();
          if (!performanceStatsSnapshotEqual(this.performanceStatsSnapshot, newPerformanceStats)) {
            this.performanceStatsSnapshot = newPerformanceStats;
            this.renderPerformanceStats();
          }
        });
    } else {
      this.debugControlsRemoved$.next();
      document.body.removeChild(this.ui.debugControlsContainer!);
      this.ui.debugControlsContainer = null;
    }
  }

  private snapshot: RuntimeDataSnapshot = {
    timeScale: 1,
    renderers: [],
    performanceStatsEnabled: false,
  };

  perfStatsMode: 'AVG' | 'PEAK' = 'AVG';
  private performanceStatsSnapshot: PerformanceStatsSnapshot = null;

  private makeSnapshot(): RuntimeDataSnapshot {
    const renderers: IRendererEntity<unknown, unknown>[] = [];
    let performanceMeter: PerformanceMeterEntity | null = null;
    for (const e of this.currentWorld?.children || []) {
      if (e instanceof IRendererEntity) {
        renderers.push(e);
      } else if (e instanceof PerformanceMeterEntity) {
        performanceMeter = e;
      }
    }
    return {
      timeScale: this.currentWorld?.worldClock.timeScale || NaN,
      renderers: renderers.map(r => ({
        name: r.name,
        entity: r as IRendererEntity<unknown, unknown>,
        physicsDebugViewActive: (r as IRendererEntity<unknown, unknown>).physicsDebugViewActive,
      })),
      performanceStatsEnabled: !!performanceMeter,
    };
  }

  private makePerformanceStatsSnapshot(): PerformanceStatsSnapshot {
    if (!this.snapshot.performanceStatsEnabled) return null;
    let performanceMeter = (this.currentWorld?.children || []).find(e => e instanceof PerformanceMeterEntity);
    if (performanceMeter) {
      if (this.perfStatsMode === 'AVG') {
        return (performanceMeter as PerformanceMeterEntity).avgReport;
      } else if (this.perfStatsMode === 'PEAK') {
        return (performanceMeter as PerformanceMeterEntity).peakReport;
      }
    }
    return null;
  }

  css = "style='display:flex;align-items:center;margin:0.25rem;'";

  private renderControls(debugControlsContainer: HTMLDivElement) {
    let html: string = '';
    for (const { entity, physicsDebugViewActive } of this.snapshot.renderers) {
      html += `
      <div ${this.css}>
        <input type='checkbox' name='checkbox' id='physics_debugger_checkbox_id_${entity.name}' value='1'${
          physicsDebugViewActive ? ' checked' : ''
        }>
        <label for='physics_debugger_checkbox_id_${entity.name}' style='user-select: none;'>Physics debugger${
          this.snapshot.renderers.length > 1 ? ' (' + entity.name + ')' : ''
        }</label>
      </div>`;
    }
    html += `
      <div ${this.css}>
        <input id='time_scale_slider' type='range' min='0' max='5' step='0.01' style='flex-grow:1' value='${this.snapshot.timeScale}'/>
        <label for='time_scale_slider' style='user-select: none;'>Time scale</label>
      </div>`;
    html +=
      `
      <div ${this.css}>
        <input type='checkbox' name='checkbox' id='perf_stats_checkbox_id' value='1'${
          this.snapshot.performanceStatsEnabled ? ' checked' : ''
        }>
        <label for='perf_stats_checkbox_id' style='user-select: none;'>Entities performance distribution</label>
      </div>
    ` +
      (this.snapshot.performanceStatsEnabled
        ? `<div ${this.css}>
          <label for='per_mode'>Mode:</label>
          <select id='per_mode'>
            <option value='AVG' ${this.perfStatsMode === 'AVG' ? 'selected' : ''}>Average</option>
            <option value='PEAK' ${this.perfStatsMode === 'PEAK' ? 'selected' : ''}>Peak</option>
          </select>
        </div>`
        : '') +
      `
      <div style='display: contents' id='perf_stats_container'></div>`;
    debugControlsContainer.innerHTML = html;
    debugControlsContainer.style.minWidth = '25rem';
    this.viewUpdated$.next();
    for (const { entity } of this.snapshot.renderers) {
      fromEvent(document.getElementById('physics_debugger_checkbox_id_' + entity.name)! as HTMLInputElement, 'change')
        .pipe(takeUntil(this.debugControlsRemoved$), takeUntil(this.viewUpdated$))
        .subscribe(e => {
          try {
            entity.physicsDebugViewActive = (e.target as HTMLInputElement).checked;
          } catch (err) {
            console.error(err);
          }
        });
    }
    fromEvent(document.getElementById('time_scale_slider')! as HTMLInputElement, 'change')
      .pipe(takeUntil(this.debugControlsRemoved$), takeUntil(this.viewUpdated$))
      .subscribe(e => {
        try {
          this.currentWorld!.worldClock.timeScale = +(e.target as HTMLInputElement).value;
        } catch (err) {
          console.error(err);
        }
      });
    fromEvent(document.getElementById('perf_stats_checkbox_id')! as HTMLInputElement, 'change')
      .pipe(takeUntil(this.debugControlsRemoved$), takeUntil(this.viewUpdated$))
      .subscribe(e => {
        const entity = (this.currentWorld?.children || []).find(x => x instanceof PerformanceMeterEntity);
        if ((e.target as HTMLInputElement).checked == !entity) {
          if (entity) {
            this.currentWorld!.removeEntity(entity);
          } else if (this.currentWorld) {
            this.currentWorld.addEntity(new PerformanceMeterEntity());
          }
        }
      });
    if (this.snapshot.performanceStatsEnabled) {
      fromEvent(document.getElementById('per_mode')! as HTMLSelectElement, 'change')
        .pipe(takeUntil(this.debugControlsRemoved$), takeUntil(this.viewUpdated$))
        .subscribe(e => {
          this.perfStatsMode = (e.target as HTMLSelectElement).value as 'AVG' | 'PEAK';
        });
    }
  }

  private renderPerformanceStats() {
    const pCss = "style='display:flex;align-items:center;margin:0.25rem;max-width:25rem'";
    const em = document.getElementById('perf_stats_container');
    if (!em) return;
    let html = '';
    if (this.performanceStatsSnapshot) {
      const total = this.performanceStatsSnapshot.totalTime;
      const labelCss = `style='user-select:none;width:3.5rem;text-align:left;flex-shrink:0;'`;
      const progressCss = `style='width:11.5rem;margin:4px;flex-shrink:0;'`;
      const spanCss = `style='user-select:none;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;width:calc(9.5rem - 8px);'`;
      html += `
          <div ${pCss}>
            <label for='stat_progress' ${labelCss}>${total.toFixed(2)}ms</label>
            <progress id='stat_progress' ${progressCss} max='16' value='${total}'></progress>
            <span ${spanCss}>Total frame time</span>
          </div>`;
      for (const [i, [name, value]] of this.performanceStatsSnapshot.entries.entries()) {
        const strVal = this.perfStatsMode == 'AVG' ? ((value * 100) / total).toFixed(2) + '%' : value.toFixed(2) + 'ms';
        html += `
          <div ${pCss}>
            <label for='stat_progress_${i}' ${labelCss}>${strVal}</label>
            <progress id='stat_progress_${i}' ${progressCss} max='${total}' value='${value}'></progress>
            <span ${spanCss}>${name}</span>
          </div>`;
      }
    }
    em.innerHTML = html;
  }
}
