import { GgStatic } from '../gg-static';
import { createInlineTickController } from '../entities/inline-controller';
import { fromEvent, Subject, takeUntil } from 'rxjs';
import Stats from 'stats.js';

export class GgDebuggerUI {
  private static _instance: GgDebuggerUI | null;
  static get instance(): GgDebuggerUI {
    if (!this._instance) {
      this._instance = new GgDebuggerUI();
    }
    return this._instance;
  }

  private ui: { stats: Stats; customContainer: HTMLDivElement } | null = null;

  private removed$: Subject<void> = new Subject<void>();

  private constructor() {}

  public get isUIShown(): boolean {
    return !!this.ui;
  }

  public createUI() {
    const stats = new Stats();
    stats.dom.style.left = 'unset';
    stats.dom.style.right = '0';
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb
    document.body.appendChild(stats.dom);
    createInlineTickController(GgStatic.instance.selectedWorld!, -1)
      .pipe(takeUntil(this.removed$))
      .subscribe(() => {
        stats?.begin();
      });
    createInlineTickController(GgStatic.instance.selectedWorld!, 10000)
      .pipe(takeUntil(this.removed$))
      .subscribe(() => {
        stats?.end();
      });
    const customContainer: HTMLDivElement = document.createElement('div');
    customContainer.style.cssText =
      'position:fixed;top:48px;right:0;opacity:0.9;z-index:9999;background-color:#333;color:white';
    customContainer.innerHTML = `<input type="checkbox" name="checkbox" id="physics_debugger_checkbox_id" value="1"${
      GgStatic.instance.selectedWorld?.physicsWorld.physicsDebugViewActive ? ' checked' : ''
    }>
                                 <label for="physics_debugger_checkbox_id" style="user-select: none;">Show physics bodies in scene</label>`;
    document.body.appendChild(customContainer);
    fromEvent(document.getElementById('physics_debugger_checkbox_id')! as HTMLInputElement, 'change')
      .pipe(takeUntil(this.removed$))
      .subscribe(e => {
        GgStatic.instance.console('dr_drawphysics ' + (e.target as HTMLInputElement).checked).then();
      });
    this.ui = {
      stats,
      customContainer,
    };
  }

  public destroyUI() {
    if (this.ui) {
      document.body.removeChild(this.ui.stats.dom);
      document.body.removeChild(this.ui.customContainer);
      this.ui.stats.end();
      this.ui = null;
    }
    this.removed$.next();
  }
}
