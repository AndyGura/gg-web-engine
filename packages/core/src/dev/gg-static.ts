import { GgWorld, KeyboardInput } from '../base';
import { GgConsoleUI } from './gg-console.ui';
import { GgDebuggerUI } from './gg-debugger.ui';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  fromEvent,
  NEVER,
  Subject,
  switchMap,
  take,
  takeUntil,
  takeWhile,
} from 'rxjs';

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
      commands = { ...commands, ...(this.consoleCommands.get(this.selectedWorld) || {}) };
    }
    return Object.entries(commands);
  }

  private constructor() {
    this.registerConsoleCommand(
      null,
      'commands',
      async () => {
        return this.availableCommands
          .map(
            ([key, value]) =>
              `<span style='color:yellow'>${key}</span>${
                value.doc ? '\t<span style="color:#aaa">// ' + value.doc + '</span>' : ''
              }`,
          )
          .join('\n\n');
      },
      'no args; Print all available commands. List includes global commands and commands, ' +
        'specific to currently selected world. Run "world" to check which world is currently ' +
        'selected and "world {world_name}" to select desired world',
    );
    this.registerConsoleCommand(
      null,
      'help',
      async (keyword: string) => {
        const command: { doc?: string } | undefined = this.availableCommands.find(([key]) => key === keyword)?.[1];
        if (!command) {
          throw new Error(`Unrecognized command: ${keyword}`);
        }
        return `<span style='color:#aaa'>${command.doc || 'No doc string given'}</span>`;
      },
      'args: [ string ]; Print doc string of provided command',
    );
    this.registerConsoleCommand(
      null,
      'worlds',
      async () => {
        return GgWorld.documentWorlds
          .map(w => (w === this.selectedWorld ? `<span style='color:lightgreen;'>* ${w.name}</span>` : `  ${w.name}`))
          .join('\n');
      },
      'no args; Print all currently available worlds',
    );
    this.registerConsoleCommand(
      null,
      'world',
      async (...args: string[]) => {
        for (const w of GgWorld.documentWorlds) {
          if (w.name === args[0]) {
            this.selectedWorld = w;
            break;
          }
        }
        return this.selectedWorld?.name || 'null';
      },
      'args: [ string? ]; Get name of selected world or select world by name. Use ' +
        '"worlds" to get list of currently available worlds',
    );
    this.registerConsoleCommand(
      null,
      'stats_panel',
      async (...args: string[]) => {
        this.showStats = args[0] === undefined ? !this.showStats : args[0] === '1';
        return this.showStats ? '1' : '0';
      },
      'args: [ 0|1? ]; Turn on/off stats panel, skip argument to toggle value',
    );
    this.registerConsoleCommand(
      null,
      'debug_panel',
      async (...args: string[]) => {
        this.showDebugControls = args[0] === undefined ? !this.showDebugControls : args[0] === '1';
        return this.showDebugControls ? '1' : '0';
      },
      'args: [ 0|1? ]; Turn on/off debug panel, skip argument to toggle value',
    );
    let unbindKey$: Subject<string> = new Subject<string>();
    this.registerConsoleCommand(
      null,
      'bind_key',
      async (keyCode: string, command: string, ...args: string[]) => {
        fromEvent(window, 'keydown')
          .pipe(
            takeUntil(unbindKey$.pipe(filter(x => x === keyCode))),
            filter(e => {
              if ((e as KeyboardEvent).code !== keyCode) {
                return false;
              }
              if (document.activeElement) {
                for (const k of KeyboardInput.externalFocusBlacklist) {
                  if (document.activeElement instanceof k) {
                    return false;
                  }
                }
              }
              return true;
            }),
          )
          .subscribe(() => {
            this.runConsoleCommand(command, args);
          });
        return 'Ok';
      },
      'args: [ string, ...string ]; Bind a keyboard key by code to console command. Check key codes' +
        ' <a target="_blank" rel="noopener noreferrer" href="https://www.toptal.com/developers/keycode">here</a>. Use "unbind_key" command to unbind it',
    );
    this.registerConsoleCommand(
      null,
      'unbind_key',
      async (...args: string[]) => {
        unbindKey$.next(args[0]);
        return 'Ok';
      },
      'args: [ string ]; Unbind a keyboard key from console command',
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
