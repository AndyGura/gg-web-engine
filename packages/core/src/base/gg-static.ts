import { GgWorld } from './gg-world';

export class GgStatic {
  private static _instance: GgStatic;
  public static get instance(): GgStatic {
    if (!GgStatic._instance) {
      GgStatic._instance = new GgStatic();
    }
    return GgStatic._instance;
  }
  private constructor() {
    (window as any).gg = this;
  }

  public readonly worlds: GgWorld<any, any>[] = [];
  public selectedWorld: GgWorld<any, any> | null = null;

  console(input: string): void {
    if (!this.selectedWorld) {
      console.log('World not selected');
      return;
    }
    const commands: string[] = input.split('\n');
    for (const command of commands) {
      const parts = command.split(' ');
      console.log(this.selectedWorld.runConsoleCommand(parts.splice(0, 1)[0], parts));
    }
  }

}
