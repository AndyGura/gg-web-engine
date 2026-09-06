import { GgStatic } from '../../src';
import { MockWorld } from '../mocks/world.mock';

describe('GgStatic', () => {
  let createdWorlds: MockWorld[];

  const makeWorld = (name: string): MockWorld => {
    const w = new MockWorld();
    w.name = name;
    createdWorlds.push(w);
    return w;
  };

  beforeEach(() => {
    delete (window as any).ggstatic;
    createdWorlds = [];
  });

  afterEach(() => {
    if ((window as any).ggstatic) {
      (window as any).ggstatic.devConsoleEnabled = false;
    }
    createdWorlds.forEach(w => w.dispose());
    delete (window as any).ggstatic;
  });

  describe('instance', () => {
    it('creates a singleton and publishes it on window.ggstatic', () => {
      const instance = GgStatic.instance;
      expect((window as any).ggstatic).toBe(instance);
      expect(GgStatic.instance).toBe(instance);
    });
  });

  describe('devConsoleEnabled', () => {
    it('is disabled by default', () => {
      expect(GgStatic.instance.devConsoleEnabled).toBe(false);
    });

    it('toggles the console UI open/closed on backquote once enabled', () => {
      const instance = GgStatic.instance;
      instance.devConsoleEnabled = true;
      expect(document.getElementById('gg-console-output')).toBeNull();

      window.dispatchEvent(new KeyboardEvent('keypress', { code: 'Backquote' }));
      expect(document.getElementById('gg-console-output')).not.toBeNull();

      window.dispatchEvent(new KeyboardEvent('keypress', { code: 'Backquote' }));
      expect(document.getElementById('gg-console-output')).toBeNull();
    });

    it('stops listening and closes the console UI when disabled again', () => {
      const instance = GgStatic.instance;
      instance.devConsoleEnabled = true;
      window.dispatchEvent(new KeyboardEvent('keypress', { code: 'Backquote' }));
      expect(document.getElementById('gg-console-output')).not.toBeNull();

      instance.devConsoleEnabled = false;
      expect(document.getElementById('gg-console-output')).toBeNull();

      window.dispatchEvent(new KeyboardEvent('keypress', { code: 'Backquote' }));
      expect(document.getElementById('gg-console-output')).toBeNull();
    });
  });

  describe('global console commands', () => {
    describe('commands', () => {
      it('lists every registered global command with its doc string', async () => {
        const instance = GgStatic.instance;
        const result = await instance.runConsoleCommand('commands', []);
        for (const name of [
          'commands',
          'help',
          'worlds',
          'world',
          'stats_panel',
          'debug_panel',
          'bind_key',
          'unbind_key',
        ]) {
          expect(result).toContain(`>${name}</span>`);
        }
      });
    });

    describe('help', () => {
      it('prints the doc string of a known command', async () => {
        const instance = GgStatic.instance;
        const result = await instance.runConsoleCommand('help', ['worlds']);
        expect(result).toContain('Print all currently available worlds');
      });

      it('reports an error for an unknown command, rendered in red', async () => {
        const instance = GgStatic.instance;
        const result = await instance.runConsoleCommand('help', ['bogus']);
        expect(result).toBe("<span style='color:red'>Error: Unrecognized command: bogus</span>");
      });
    });

    describe('worlds / world', () => {
      it('worlds lists all worlds, marking the auto-selected one', async () => {
        const instance = GgStatic.instance;
        makeWorld('Alpha');
        makeWorld('Beta');

        const result = await instance.runConsoleCommand('worlds', []);
        expect(result).toContain("<span style='color:lightgreen;'>* Alpha</span>");
        expect(result).toContain('  Beta');
      });

      it('world reports the current selection and switches by name', async () => {
        const instance = GgStatic.instance;
        const w1 = makeWorld('Alpha');
        const w2 = makeWorld('Beta');

        expect(instance.selectedWorld).toBe(w1);
        expect(await instance.runConsoleCommand('world', [])).toBe('Alpha');
        expect(await instance.runConsoleCommand('world', ['Beta'])).toBe('Beta');
        expect(instance.selectedWorld).toBe(w2);
      });

      it('world reports "null" when no world exists yet', async () => {
        const instance = GgStatic.instance;
        expect(await instance.runConsoleCommand('world', [])).toBe('null');
      });
    });

    describe('stats_panel', () => {
      it('toggles when given no args', async () => {
        const instance = GgStatic.instance;
        expect(instance.showStats).toBe(false);
        expect(await instance.runConsoleCommand('stats_panel', [])).toBe('1');
        expect(instance.showStats).toBe(true);
        expect(await instance.runConsoleCommand('stats_panel', [])).toBe('0');
        expect(instance.showStats).toBe(false);
      });

      it('sets an explicit value', async () => {
        const instance = GgStatic.instance;
        expect(await instance.runConsoleCommand('stats_panel', ['1'])).toBe('1');
        expect(instance.showStats).toBe(true);
        expect(await instance.runConsoleCommand('stats_panel', ['0'])).toBe('0');
        expect(instance.showStats).toBe(false);
      });
    });

    describe('debug_panel', () => {
      it('toggles when given no args', async () => {
        const instance = GgStatic.instance;
        expect(instance.showDebugControls).toBe(false);
        expect(await instance.runConsoleCommand('debug_panel', [])).toBe('1');
        expect(instance.showDebugControls).toBe(true);
        expect(await instance.runConsoleCommand('debug_panel', [])).toBe('0');
        expect(instance.showDebugControls).toBe(false);
      });

      it('sets an explicit value', async () => {
        const instance = GgStatic.instance;
        expect(await instance.runConsoleCommand('debug_panel', ['1'])).toBe('1');
        expect(instance.showDebugControls).toBe(true);
      });
    });

    describe('bind_key / unbind_key', () => {
      it('binds a key to run a command with the given args', async () => {
        const instance = GgStatic.instance;
        await instance.runConsoleCommand('bind_key', ['KeyP', 'stats_panel', '1']);

        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
        expect(instance.showStats).toBe(true);

        await instance.runConsoleCommand('unbind_key', ['KeyP']);
      });

      it('unbind_key stops the bound key from running the command', async () => {
        const instance = GgStatic.instance;
        await instance.runConsoleCommand('bind_key', ['KeyQ', 'stats_panel', '1']);
        await instance.runConsoleCommand('unbind_key', ['KeyQ']);

        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
        expect(instance.showStats).toBe(false);
      });

      it('ignores keydown while a blacklisted element (e.g. an input) has focus', async () => {
        const instance = GgStatic.instance;
        await instance.runConsoleCommand('bind_key', ['KeyR', 'stats_panel', '1']);

        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();

        input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
        expect(instance.showStats).toBe(false);

        document.body.removeChild(input);
        await instance.runConsoleCommand('unbind_key', ['KeyR']);
      });
    });
  });

  describe('registerConsoleCommand / deregisterWorldCommands', () => {
    it('registers a global command available regardless of selected world', async () => {
      const instance = GgStatic.instance;
      instance.registerConsoleCommand(null, 'ping', async () => 'pong');
      expect(await instance.runConsoleCommand('ping', [])).toBe('pong');
    });

    it('registers a world-scoped command only visible while that world is selected', async () => {
      const instance = GgStatic.instance;
      const w1 = makeWorld('Alpha');
      makeWorld('Beta');
      instance.registerConsoleCommand(w1, 'only_alpha', async () => 'alpha-only');

      expect(instance.selectedWorld).toBe(w1);
      expect(await instance.runConsoleCommand('only_alpha', [])).toBe('alpha-only');

      await instance.runConsoleCommand('world', ['Beta']);
      expect(await instance.runConsoleCommand('only_alpha', [])).toContain('Unrecognized command: only_alpha');
    });

    it('deregisterWorldCommands removes every command registered for that world', async () => {
      const instance = GgStatic.instance;
      const w1 = makeWorld('Alpha');
      instance.registerConsoleCommand(w1, 'only_alpha', async () => 'alpha-only');

      instance.deregisterWorldCommands(w1);

      expect(await instance.runConsoleCommand('only_alpha', [])).toContain('Unrecognized command: only_alpha');
    });
  });

  describe('runConsoleCommand', () => {
    it('reports an unrecognized command in red', async () => {
      const instance = GgStatic.instance;
      expect(await instance.runConsoleCommand('bogus', [])).toBe(
        "<span style='color:red'>Unrecognized command: bogus</span>",
      );
    });

    it('catches a thrown error from a handler and renders it in red', async () => {
      const instance = GgStatic.instance;
      instance.registerConsoleCommand(null, 'boom', async () => {
        throw new Error('kaboom');
      });
      expect(await instance.runConsoleCommand('boom', [])).toBe("<span style='color:red'>Error: kaboom</span>");
    });
  });

  describe('console', () => {
    it('runs multiple newline-separated commands and joins their output', async () => {
      const instance = GgStatic.instance;
      instance.registerConsoleCommand(null, 'echo', async (...args: string[]) => args.join(' '));

      const result = await instance.console('echo one\necho two');
      expect(result).toBe('one\ntwo');
    });
  });
});
