import { GgWorld } from '../../src';

export type ConsoleCommandHandler = (...args: string[]) => Promise<string>;

/**
 * Drives a world's `registerConsoleCommands` with a fake `GgStatic`, capturing every command it
 * registers into a plain Map, keyed by command name. Lets tests call a command's handler directly
 * without going through the real `GgStatic` singleton/dispatch.
 */
export function collectConsoleCommands(world: GgWorld<any, any>): Map<string, ConsoleCommandHandler> {
  const commands = new Map<string, ConsoleCommandHandler>();
  const fakeGgstatic = {
    registerConsoleCommand: (
      _world: GgWorld<any, any> | null,
      command: string,
      handler: ConsoleCommandHandler,
    ): void => {
      commands.set(command, handler);
    },
  };
  (world as any).registerConsoleCommands(fakeGgstatic);
  return commands;
}
