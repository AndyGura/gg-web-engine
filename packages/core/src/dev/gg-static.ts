import { GgWorld } from '../base';
import { GgConsoleUI } from './gg-console.ui';
import { GgDebuggerUI } from './gg-debugger.ui';
import { BehaviorSubject, combineLatest, NEVER, switchMap, take, takeWhile } from 'rxjs';

export class GgStatic {
  public static get instance(): GgStatic {
    if (!(window as any).ggstatic) {
      return new GgStatic();
    }
    return (window as any).ggstatic as GgStatic;
  }

  private readonly debuggerUI: GgDebuggerUI = new GgDebuggerUI();
  private readonly consoleUI: GgConsoleUI = new GgConsoleUI();

  private _devConsoleEnabled: boolean = false;
  get devConsoleEnabled(): boolean {
    return this._devConsoleEnabled;
  }

  consoleKeyPressEventListener = (event: KeyboardEvent) => {
    if (event.code === 'Backquote') {
      event.preventDefault();
      if (this.consoleUI.isUIShown) {
        this.consoleUI.destroyUI();
      } else {
        this.consoleUI.createUI();
      }
    }
  };

  set devConsoleEnabled(value: boolean) {
    if (this._devConsoleEnabled === value) {
      return;
    }
    this._devConsoleEnabled = value;
    if (value) {
      addEventListener('keypress', this.consoleKeyPressEventListener);
    } else {
      removeEventListener('keypress', this.consoleKeyPressEventListener);
      if (this.consoleUI.isUIShown) {
        this.consoleUI.destroyUI();
      }
    }
  }

  public toggleDevConsole(value: boolean) {
    if (value === this.consoleUI.isUIShown) return;
    if (this.consoleUI.isUIShown) {
      this.consoleUI.destroyUI();
    } else {
      this.consoleUI.createUI();
    }
  }

  private showStats$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  public get showStats(): boolean {
    return this.showStats$.getValue();
  }

  public set showStats(value: boolean) {
    if (value === this.showStats) return;
    this.showStats$.next(value);
  }

  private showDebugControls$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  public get showDebugControls(): boolean {
    return this.showDebugControls$.getValue();
  }

  public set showDebugControls(value: boolean) {
    if (value === this.showDebugControls) return;
    this.showDebugControls$.next(value);
  }

  private _selectedWorld$: BehaviorSubject<GgWorld<any, any> | null> = new BehaviorSubject<GgWorld<any, any> | null>(
    null,
  );

  public get selectedWorld(): GgWorld<any, any> | null {
    return this._selectedWorld$.getValue();
  }

  private set selectedWorld(w: GgWorld<any, any> | null) {
    this._selectedWorld$.next(w);
  }

  private autoAssignSelectedWorld() {
    if (GgWorld.documentWorlds.length > 0) {
      this.selectedWorld = GgWorld.documentWorlds[0];
    } else {
      GgWorld.worldCreated$
        .pipe(
          takeWhile(() => !this.selectedWorld),
          take(1),
        )
        .subscribe(w => (this.selectedWorld = w));
    }
  }

  public get availableCommands(): [string, { handler: (...args: string[]) => Promise<string>; doc?: string }][] {
    let commands = this.consoleCommands.get(null) || {};
    if (this.selectedWorld) {
      commands = { ...(this.consoleCommands.get(this.selectedWorld) || {}), ...commands };
    }
    return Object.entries(commands);
  }

  private constructor() {
    this.registerConsoleCommand(
      null,
      'ls_commands',
      async () => {
        return this.availableCommands
          .map(
            ([key, value]) =>
              `<span style='color:yellow'>${key}</span>${
                value.doc ? '\t<span style="color:#aaa">// ' + value.doc + '</span>' : ''
              }`,
          )
          .sort()
          .join('\n\n');
      },
      'no args; print all available commands',
    );
    this.registerConsoleCommand(
      null,
      'ls_worlds',
      async () => {
        return GgWorld.documentWorlds
          .map(w => (w === this.selectedWorld ? `<span style='color:lightgreen;'>* ${w.name}</span>` : `  ${w.name}`))
          .join('\n');
      },
      'no args; print all available worlds',
    );
    this.registerConsoleCommand(
      null,
      'select_world',
      async (...args: string[]) => {
        for (const w of GgWorld.documentWorlds) {
          if (w.name === args[0]) {
            this.selectedWorld = w;
            break;
          }
        }
        return this.selectedWorld?.name || 'null';
      },
      'args: [string]; select world by name',
    );
    this.registerConsoleCommand(
      null,
      'show_debugger',
      async (...args: string[]) => {
        this.showDebugControls = ['1', 'true', '+'].includes(args[0]);
        return '' + this.showDebugControls;
      },
      'args: [0 or 1]; turn on/off debug panel. Default value is 0',
    );
    this.registerConsoleCommand(
      null,
      'show_stats',
      async (...args: string[]) => {
        this.showStats = ['1', 'true', '+'].includes(args[0]);
        return '' + this.showStats;
      },
      'args: [0 or 1]; turn on/off stats. Default value is 0',
    );
    (window as any).ggstatic = this;
    this.autoAssignSelectedWorld();
    this._selectedWorld$.pipe(switchMap(w => (w ? w.disposed$ : NEVER))).subscribe(() => {
      this.selectedWorld = null;
      this.autoAssignSelectedWorld();
    });
    window.dispatchEvent(new Event('ggstatic_added'));

    combineLatest([this._selectedWorld$, this.showDebugControls$]).subscribe(([world, showControls]) => {
      this.debuggerUI.setShowDebugControls(world, !!world && showControls);
    });
    combineLatest([this._selectedWorld$, this.showStats$]).subscribe(([world, showStats]) => {
      this.debuggerUI.setShowStats(world, !!world && showStats);
    });
  }

  protected consoleCommands: Map<
    GgWorld<any, any> | null,
    {
      [key: string]: { handler: (...args: string[]) => Promise<string>; doc?: string };
    }
  > = new Map();

  public registerConsoleCommand(
    world: GgWorld<any, any> | null,
    command: string,
    handler: (...args: string[]) => Promise<string>,
    doc?: string,
  ): void {
    let commands: { [key: string]: { handler: (...args: string[]) => Promise<string>; doc?: string } } = {};
    if (!this.consoleCommands.has(world)) {
      this.consoleCommands.set(world, commands);
    } else {
      commands = this.consoleCommands.get(world)!;
    }
    commands[command] = { handler, doc };
  }

  public deregisterWorldCommands(world: GgWorld<any, any> | null): void {
    this.consoleCommands.delete(world);
  }

  public async console(input: string): Promise<string> {
    const commands: string[] = input.split('\n');
    let output: string[] = [];
    for (const command of commands) {
      const parts = command.split(' ');
      output.push(await this.runConsoleCommand(parts.splice(0, 1)[0], parts));
    }
    return output.join('\n');
  }

  public async runConsoleCommand(command: string, args: string[]): Promise<string> {
    let action = (this.consoleCommands.get(null) || {})[command];
    if (!action) {
      action = (this.consoleCommands.get(this.selectedWorld) || {})[command];
      if (!action) {
        return `<span style='color:red'>Unrecognized command: ${command}</span>`;
      }
    }
    try {
      return await action.handler(...args);
    } catch (err) {
      return `<span style='color:red'>${err}</span>`;
    }
  }
}
