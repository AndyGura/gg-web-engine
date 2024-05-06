import { GgWorld } from '../base';
import { GgConsoleUI } from './gg-console.ui';
import { GgDebuggerUI } from './gg-debugger.ui';

export class GgStatic {
  public static get instance(): GgStatic {
    if (!(window as any).ggstatic) {
      (window as any).ggstatic = new GgStatic();
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

  public get showStats(): boolean {
    return this.debuggerUI.showStats;
  }

  public set showStats(value: boolean) {
    this.debuggerUI.setShowStats(this.selectedWorld!, value);
  }

  public get showDebugControls(): boolean {
    return this.debuggerUI.showDebugControls;
  }

  public set showDebugControls(value: boolean) {
    this.debuggerUI.setShowDebugControls(this.selectedWorld!, value);
  }

  private _selectedWorld: GgWorld<any, any> | null = null;
  public get selectedWorld(): GgWorld<any, any> | null {
    return this._selectedWorld || GgWorld.documentWorlds[0] || null;
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
              `<span style="color:yellow">${key}</span>${
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
          .map(w => (w === this.selectedWorld ? `<span style="color:green;">* ${w.name}</span>` : `  ${w.name}`))
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
            this._selectedWorld = w;
            break;
          }
        }
        return this.selectedWorld?.name || 'null';
      },
      'args: [string]; select world by name',
    );
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
        return `<span style="color:red">Unrecognized command: ${command}</span>`;
      }
    }
    try {
      return await action.handler(...args);
    } catch (err) {
      return `<span style="color:red">${err}</span>`;
    }
  }
}
