import { createInlineTickController, GgWorld } from '../base';
import { fromEvent, Subject, takeUntil } from 'rxjs';
import Stats from 'stats.js';

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

  private currentWorld: GgWorld<any, any> = null!;

  public setShowStats(selectedWorld: GgWorld<any, any>, value: boolean) {
    if (value === this.showStats) {
      if (value && this.currentWorld !== selectedWorld) {
        this.setShowStats(this.currentWorld, false);
      } else {
        return;
      }
    }
    this.currentWorld = selectedWorld;
    if (value) {
      const stats = new Stats();
      this.ui.stats = stats;
      stats.dom.style.left = 'unset';
      stats.dom.style.right = '0';
      stats.showPanel(0); // 0: fps, 1: ms, 2: mb
      document.body.appendChild(stats.dom);
      createInlineTickController(selectedWorld, -1)
        .pipe(takeUntil(this.statsRemoved$))
        .subscribe(() => {
          stats?.begin();
        });
      createInlineTickController(selectedWorld, 10000)
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

  public get showDebugControls(): boolean {
    return !!this.ui.debugControlsContainer;
  }

  public setShowDebugControls(selectedWorld: GgWorld<any, any>, value: boolean) {
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
      this.ui.debugControlsContainer = debugControlsContainer;
      const debugLabelCss = "style='display:flex;align-items:center;margin:0.25rem;'";
      debugControlsContainer.style.cssText =
        'position:fixed;top:48px;right:0;opacity:0.9;z-index:9999;background-color:#333;color:white;display:flex;flex-direction:column';
      debugControlsContainer.innerHTML = `
      <div ${debugLabelCss}>
        <input type='checkbox' name='checkbox' id='physics_debugger_checkbox_id' value='1'${
          this.currentWorld.physicsWorld.physicsDebugViewActive ? ' checked' : ''
        }>
        <label for='physics_debugger_checkbox_id' style='user-select: none;'>Show physics bodies in scene</label>
      </div>`;
      // <div ${debugLabelCss}>
      //   <input id="time_scale_slider" type="range" min="0" max="10" step="0.1" style="flex-grow:1" value="${
      //      this.currentWorld.physicsWorld.timeScale
      //   }"/>
      //   <label for="time_scale_slider" style="user-select: none;">Time scale</label>
      // </div>`;
      document.body.appendChild(debugControlsContainer);
      fromEvent(document.getElementById('physics_debugger_checkbox_id')! as HTMLInputElement, 'change')
        .pipe(takeUntil(this.debugControlsRemoved$))
        .subscribe(e => {
          try {
            this.currentWorld.physicsDebugViewActive = (e.target as HTMLInputElement).checked;
          } catch (err) {
            console.error(err);
          }
          (e.target as HTMLInputElement).checked = this.currentWorld.physicsDebugViewActive;
        });
      // fromEvent(document.getElementById('time_scale_slider')! as HTMLInputElement, 'change')
      //   .pipe(takeUntil(this.debugControlsRemoved$))
      //   .subscribe(e => {
      //     try {
      //        this.currentWorld.physicsWorld.timeScale = +(e.target as HTMLInputElement).value;
      //     } catch (err) {
      //       console.error(err);
      //     }
      //     (e.target as HTMLInputElement).value = '' + ( this.currentWorld.physicsWorld.timeScale || 1);
      //   });
    } else {
      this.debugControlsRemoved$.next();
      document.body.removeChild(this.ui.debugControlsContainer!);
      this.ui.debugControlsContainer = null;
    }
  }
}
