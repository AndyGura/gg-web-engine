import {
  GgWorld,
  LoadingView,
  LoadProgress,
  runWhileInputEnabled,
  Screen,
  ScreenEnterContext,
  ScreenManager,
} from '../../../src';
import { MockWorld } from '../../mocks/world.mock';

const flush = async (times = 5) => {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
};

/** A screen that writes its lifecycle into a shared log. */
class LogScreen extends Screen {
  constructor(
    public readonly label: string,
    protected readonly log: string[],
  ) {
    super();
  }

  enter(_ctx: ScreenEnterContext): void | Promise<void> {
    this.log.push(`enter ${this.label}`);
    this.addTeardown(() => this.log.push(`teardown ${this.label}`));
  }

  exit(): void {
    this.log.push(`exit ${this.label}`);
  }

  onCovered(): void {
    this.log.push(`covered ${this.label}`);
  }

  onUncovered(): void {
    this.log.push(`uncovered ${this.label}`);
  }
}

class MenuScreen extends LogScreen {}
class SettingsScreen extends LogScreen {}

/** A screen with a running world, like a game. */
class WorldScreen extends LogScreen {
  public world!: MockWorld;

  async enter(ctx: ScreenEnterContext): Promise<void> {
    super.enter(ctx);
    this.world = this.addWorld(new MockWorld());
    await this.world.init();
    this.world.start();
  }
}

/** A screen whose enter() stays pending until the test lets it go. */
class SlowScreen extends LogScreen {
  public ctx!: ScreenEnterContext;
  public finish: () => void = () => {};
  public fail: (e: Error) => void = () => {};

  enter(ctx: ScreenEnterContext): Promise<void> {
    super.enter(ctx);
    this.ctx = ctx;
    return new Promise<void>((resolve, reject) => {
      this.finish = resolve;
      this.fail = reject;
      ctx.signal.addEventListener('abort', () => {
        const e = new Error('aborted');
        e.name = 'AbortError';
        reject(e);
      });
    });
  }
}

describe('ScreenManager', () => {
  let screens: ScreenManager;
  let log: string[];

  beforeEach(() => {
    log = [];
    screens = new ScreenManager({ loadingView: null });
  });

  afterEach(async () => {
    await screens.dispose();
    jest.useRealTimers();
  });

  const layers = () => [...screens.container.querySelectorAll('.gg-screen')] as HTMLElement[];

  describe('stack operations', () => {
    it('push enters the screen, gives it a visible layer and makes it the top', async () => {
      const menu = new MenuScreen('menu', log);
      expect(() => menu.layer).toThrow();
      const stacks: number[] = [];
      screens.stack$.subscribe(stack => stacks.push(stack.length));

      await screens.push(menu);

      expect(log).toEqual(['enter menu']);
      expect(screens.top).toBe(menu);
      expect(menu.state).toBe('active');
      expect(menu.screens).toBe(screens);
      expect(layers()).toEqual([menu.layer]);
      expect(menu.layer.style.visibility).toBe('');
      expect(stacks).toEqual([0, 1]);
    });

    it('push covers the screen below, pop uncovers it and exits the top', async () => {
      const menu = new MenuScreen('menu', log);
      const settings = new SettingsScreen('settings', log);
      await screens.push(menu);
      await screens.push(settings);

      expect(menu.state).toBe('covered');
      expect(menu.layer.hasAttribute('inert')).toBe(true);
      expect(layers()).toEqual([menu.layer, settings.layer]);
      expect(+settings.layer.style.zIndex).toBeGreaterThan(+menu.layer.style.zIndex);

      await screens.pop();

      expect(log).toEqual([
        'enter menu',
        'covered menu',
        'enter settings',
        'exit settings',
        'teardown settings',
        'uncovered menu',
      ]);
      expect(menu.state).toBe('active');
      expect(menu.layer.hasAttribute('inert')).toBe(false);
      expect(settings.state).toBe('exited');
      expect(layers()).toEqual([menu.layer]);
      expect(() => settings.layer).toThrow();
    });

    it('replace exits the old top before the new one enters', async () => {
      await screens.push(new MenuScreen('menu', log));
      await screens.push(new LogScreen('a', log));
      log.length = 0;
      await screens.replace(new LogScreen('b', log));
      expect(log).toEqual(['exit a', 'teardown a', 'enter b']);
      expect(screens.stack.map(s => (s as LogScreen).label)).toEqual(['menu', 'b']);
    });

    it('clearHistory exits everything below, top down, and leaves the new screen as the root', async () => {
      await screens.push(new MenuScreen('menu', log));
      await screens.push(new SettingsScreen('settings', log));
      log.length = 0;
      const game = new LogScreen('game', log);
      await screens.push(game, { clearHistory: true });
      expect(log).toEqual(['exit settings', 'teardown settings', 'exit menu', 'teardown menu', 'enter game']);
      expect(screens.stack).toEqual([game]);
    });

    it('pop(n) removes several screens in one transition, uncovering only the one that ends up on top', async () => {
      const menu = new MenuScreen('menu', log);
      await screens.push(menu);
      await screens.push(new LogScreen('a', log));
      await screens.push(new LogScreen('b', log));
      log.length = 0;
      await screens.pop(2);
      expect(log).toEqual(['exit b', 'teardown b', 'exit a', 'teardown a', 'uncovered menu']);
      expect(screens.stack).toEqual([menu]);
    });

    it('popTo goes back to a screen instance or to the topmost screen of a class', async () => {
      const menu = new MenuScreen('menu', log);
      const settings = new SettingsScreen('settings', log);
      await screens.push(menu);
      await screens.push(settings);
      await screens.push(new LogScreen('a', log));
      await screens.popTo(SettingsScreen);
      expect(screens.top).toBe(settings);
      await screens.popTo(menu);
      expect(screens.stack).toEqual([menu]);
      await expect(screens.popTo(SettingsScreen)).rejects.toThrow('no such screen');
      expect(screens.stack).toEqual([menu]);
    });

    it('reset rebuilds the stack in one go: kept screens stay, lower new ones enter when first uncovered', async () => {
      const menu = new MenuScreen('menu', log);
      await screens.push(menu);
      await screens.push(new LogScreen('old', log));
      log.length = 0;

      const lobby = new LogScreen('lobby', log);
      const game = new LogScreen('game', log);
      await screens.reset([menu, lobby, game]);

      expect(log).toEqual(['exit old', 'teardown old', 'enter game']);
      expect(menu.state).toBe('covered');
      expect(lobby.state).toBe('pending');
      expect(lobby.layer.style.visibility).toBe('hidden');

      await screens.pop();
      expect(log.slice(3)).toEqual(['exit game', 'teardown game', 'enter lobby']);
      expect(lobby.state).toBe('active');
      expect(lobby.layer.style.visibility).toBe('');
    });

    it('never calls exit() on a screen that was removed before it ever entered', async () => {
      const lobby = new LogScreen('lobby', log);
      await screens.reset([lobby, new LogScreen('game', log)]);
      await screens.reset([]);
      expect(log).toEqual(['enter game', 'exit game', 'teardown game']);
      expect(lobby.state).toBe('exited');
    });

    it('refuses a screen that has already exited', async () => {
      const menu = new MenuScreen('menu', log);
      await screens.push(menu);
      await screens.pop();
      await expect(screens.push(menu)).rejects.toThrow('cannot be shown again');
    });

    it('runs requests one after another in the order they were made', async () => {
      const a = screens.push(new LogScreen('a', log));
      const b = screens.push(new LogScreen('b', log));
      const c = screens.pop();
      await Promise.all([a, b, c]);
      expect(log).toEqual(['enter a', 'covered a', 'enter b', 'exit b', 'teardown b', 'uncovered a']);
    });

    it('reports busy while transitions run', async () => {
      const busy: boolean[] = [];
      screens.busy$.subscribe(value => busy.push(value));
      await screens.push(new LogScreen('a', log));
      await flush();
      expect(busy).toEqual([false, true, false]);
    });
  });

  describe('covered worlds', () => {
    let game: WorldScreen;

    beforeEach(async () => {
      game = new WorldScreen('game', log);
      await screens.push(game);
    });

    it('pauses the world and switches its input off while covered, and gives both back afterwards', async () => {
      expect(game.world.isPaused).toBe(false);
      await screens.push(new LogScreen('pause', log));
      expect(game.world.isPaused).toBe(true);
      expect(game.world.inputEnabled).toBe(false);
      expect(game.world.keyboardInput.running).toBe(false);

      await screens.pop();
      expect(game.world.isPaused).toBe(false);
      expect(game.world.inputEnabled).toBe(true);
      expect(game.world.keyboardInput.running).toBe(true);
    });

    it('keeps a world running that may not be paused locally (a joined network session), input still off', async () => {
      game.world.localPauseAllowed = false;
      await screens.push(new LogScreen('pause', log));
      expect(game.world.isPaused).toBe(false);
      expect(game.world.inputEnabled).toBe(false);
      await screens.pop();
      expect(game.world.inputEnabled).toBe(true);
    });

    it('keeps the world running when the push asks for it', async () => {
      await screens.push(new LogScreen('inventory', log), { pauseBelow: false });
      expect(game.world.isPaused).toBe(false);
      expect(game.world.inputEnabled).toBe(false);
    });

    it('does not resume a world the app had paused itself', async () => {
      game.world.pauseWorld();
      await screens.push(new LogScreen('pause', log));
      await screens.pop();
      expect(game.world.isPaused).toBe(true);
    });

    it('stays covered, and paused, under more than one screen', async () => {
      await screens.push(new LogScreen('pause', log));
      await screens.push(new LogScreen('settings', log), { pauseBelow: false });
      expect(game.world.isPaused).toBe(true);
      await screens.pop();
      expect(game.world.isPaused).toBe(true);
      expect(game.world.inputEnabled).toBe(false);
      await screens.pop();
      expect(game.world.isPaused).toBe(false);
    });

    it('disposes the world when the screen exits', async () => {
      const disposed = jest.fn();
      game.world.disposed$.subscribe(disposed);
      await screens.pop();
      expect(disposed).toHaveBeenCalledTimes(1);
      expect(GgWorld.documentWorlds).not.toContain(game.world);
    });
  });

  describe('input of covered screens', () => {
    const press = (code: string) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code }));
    };

    it("a covered screen's world does not react to the keyboard", async () => {
      const game = new WorldScreen('game', log);
      await screens.push(game);
      const jump = jest.fn();
      game.world.keyboardInput.bind('Space').subscribe(down => down && jump());

      press('Space');
      expect(jump).toHaveBeenCalledTimes(1);

      await screens.push(new LogScreen('pause', log));
      press('Space');
      game.world.keyboardInput.emulateKeyDown('Space');
      expect(jump).toHaveBeenCalledTimes(1);

      await screens.pop();
      press('Space');
      expect(jump).toHaveBeenCalledTimes(2);
    });

    it('releases a key that was held when the screen got covered', async () => {
      const game = new WorldScreen('game', log);
      await screens.push(game);
      const states: boolean[] = [];
      game.world.keyboardInput.bind('KeyW').subscribe(down => states.push(down));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      await screens.push(new LogScreen('pause', log));
      expect(states).toEqual([false, true, false]);
    });

    it("stops and restarts whatever follows the world's inputEnabled (the built-in controllers' inputs)", async () => {
      const game = new WorldScreen('game', log);
      await screens.push(game);
      const start = jest.fn();
      const stop = jest.fn();
      runWhileInputEnabled(game.world, game.world.disposed$, start, stop);
      expect(start).toHaveBeenCalledTimes(1);

      await screens.push(new LogScreen('pause', log));
      expect(stop).toHaveBeenCalledTimes(1);
      await screens.pop();
      expect(start).toHaveBeenCalledTimes(2);
    });

    it("a screen's own keyboard runs only while the screen is on top", async () => {
      const menu = new MenuScreen('menu', log);
      const pressed = jest.fn();
      await screens.push(menu);
      menu.keyboard.bind('Escape').subscribe(down => down && pressed());

      press('Escape');
      expect(pressed).toHaveBeenCalledTimes(1);

      await screens.push(new LogScreen('settings', log));
      press('Escape');
      expect(pressed).toHaveBeenCalledTimes(1);

      await screens.pop();
      press('Escape');
      expect(pressed).toHaveBeenCalledTimes(2);

      await screens.pop();
      press('Escape');
      expect(pressed).toHaveBeenCalledTimes(2);
      expect(menu.keyboard.running).toBe(false);
    });

    it('does not run the keyboard of a screen that is still entering', async () => {
      const slow = new SlowScreen('slow', log);
      const pending = screens.push(slow);
      await flush();
      expect(slow.keyboard.running).toBe(false);
      slow.finish();
      await pending;
      expect(slow.keyboard.running).toBe(true);
    });
  });

  describe('entering', () => {
    class FakeLoadingView implements LoadingView {
      static instances: FakeLoadingView[] = [];
      element = document.createElement('div');
      progress: LoadProgress[] = [];
      disposed = false;
      constructor() {
        this.element.className = 'fake-loading';
        FakeLoadingView.instances.push(this);
      }
      setProgress(progress: LoadProgress): void {
        this.progress.push(progress);
      }
      dispose(): void {
        this.disposed = true;
        this.element.remove();
      }
    }

    beforeEach(async () => {
      FakeLoadingView.instances = [];
      await screens.dispose();
      screens = new ScreenManager({ loadingView: () => new FakeLoadingView(), loadingDelay: 100 });
    });

    it('keeps the layer hidden and shows the loading view, fed with reported progress, after the delay', async () => {
      jest.useFakeTimers();
      const slow = new SlowScreen('slow', log);
      const pending = screens.push(slow);
      await flush();

      expect(slow.state).toBe('entering');
      expect(slow.layer.style.visibility).toBe('hidden');
      slow.ctx.reportProgress(0.25);
      expect(FakeLoadingView.instances).toHaveLength(0);

      jest.advanceTimersByTime(100);
      const view = FakeLoadingView.instances[0];
      expect(view.element.parentElement).toBe(screens.container);
      // what was reported before the view appeared is not lost
      expect(view.progress[view.progress.length - 1].fraction).toBe(0.25);

      const loaderProgress: LoadProgress = {
        fraction: 0.5,
        loadedItems: 1,
        totalItems: 2,
        bytesLoaded: 10,
        bytesTotal: 20,
        current: 'a.glb',
      };
      slow.ctx.reportProgress(loaderProgress);
      expect(view.progress[view.progress.length - 1]).toBe(loaderProgress);

      slow.finish();
      await pending;
      expect(view.disposed).toBe(true);
      expect(slow.layer.style.visibility).toBe('');
      expect(slow.state).toBe('active');
    });

    it('never shows the loading view for a screen that is ready before the delay', async () => {
      jest.useFakeTimers();
      await screens.push(new LogScreen('quick', log));
      jest.advanceTimersByTime(1000);
      expect(FakeLoadingView.instances).toHaveLength(0);
    });

    it('covers the screen below while the new one loads', async () => {
      const game = new WorldScreen('game', log);
      await screens.push(game);
      const slow = new SlowScreen('slow', log);
      const pending = screens.push(slow);
      await flush();
      expect(game.state).toBe('covered');
      expect(game.world.inputEnabled).toBe(false);
      slow.finish();
      await pending;
    });

    it('going back during a load aborts it: no exit(), teardowns run, the screen below is on top again', async () => {
      const menu = new MenuScreen('menu', log);
      await screens.push(menu);
      const slow = new SlowScreen('slow', log);
      const pushed = screens.push(slow);
      await flush();
      log.length = 0;

      const popped = screens.pop();
      expect(slow.ctx.signal.aborted).toBe(true);
      await Promise.all([pushed, popped]);

      expect(log).toEqual(['teardown slow', 'uncovered menu']);
      expect(slow.state).toBe('exited');
      expect(screens.stack).toEqual([menu]);
      expect(menu.state).toBe('active');
    });

    it('disposes a world the aborted screen adds after it was already removed', async () => {
      class LateWorldScreen extends SlowScreen {
        addLate(): GgWorld<any, any> {
          return this.addWorld(new MockWorld());
        }
      }
      await screens.push(new MenuScreen('menu', log));
      const slow = new LateWorldScreen('slow', log);
      const pushed = screens.push(slow);
      await flush();
      await Promise.all([pushed, screens.pop()]);
      const world = slow.addLate();
      expect(GgWorld.documentWorlds).not.toContain(world);
    });

    it('a plain push during a load waits for it instead of aborting it', async () => {
      const slow = new SlowScreen('slow', log);
      const first = screens.push(slow);
      await flush();
      const overlay = new LogScreen('overlay', log);
      const second = screens.push(overlay);
      await flush();
      expect(slow.ctx.signal.aborted).toBe(false);
      expect(overlay.state).toBe('pending');
      slow.finish();
      await Promise.all([first, second]);
      expect(screens.stack).toEqual([slow, overlay]);
    });

    it('replacing a loading screen aborts it and enters the replacement', async () => {
      const menu = new MenuScreen('menu', log);
      await screens.push(menu);
      const slow = new SlowScreen('slow', log);
      const first = screens.push(slow);
      await flush();
      const other = new LogScreen('other', log);
      await Promise.all([first, screens.replace(other)]);
      expect(screens.stack).toEqual([menu, other]);
      expect(slow.state).toBe('exited');
    });

    it('removes a screen whose enter() throws, shows the one below again and rejects', async () => {
      const menu = new MenuScreen('menu', log);
      await screens.push(menu);
      const slow = new SlowScreen('slow', log);
      const pushed = screens.push(slow);
      await flush();
      log.length = 0;
      slow.fail(new Error('level is broken'));

      await expect(pushed).rejects.toThrow('level is broken');
      expect(log).toEqual(['teardown slow', 'uncovered menu']);
      expect(screens.stack).toEqual([menu]);
      expect(menu.state).toBe('active');
      expect(FakeLoadingView.instances.every(v => v.disposed)).toBe(true);
    });
  });

  describe('dev console', () => {
    afterEach(() => {
      delete (window as any).ggstatic;
    });

    const fakeGgstatic = () => {
      const commands = new Map<string, (...args: string[]) => Promise<string>>();
      return {
        commands,
        registerConsoleCommand: jest.fn((_world: unknown, name: string, handler: any) => commands.set(name, handler)),
        deregisterConsoleCommand: jest.fn((_world: unknown, name: string) => commands.delete(name)),
      };
    };

    it('registers its commands through window.ggstatic when that exists, and removes them on dispose', async () => {
      const ggstatic = fakeGgstatic();
      (window as any).ggstatic = ggstatic;
      const manager = new ScreenManager({ loadingView: null });
      await manager.push(new MenuScreen('menu', log));
      await manager.push(new SettingsScreen('settings', log));

      expect(await ggstatic.commands.get('screens')!()).toBe('0: MenuScreen (covered)\n1: SettingsScreen (active)');
      expect(await ggstatic.commands.get('screen_pop')!()).toBe('popped, 1 screen(s) left');
      expect(manager.stack).toHaveLength(1);

      await manager.dispose();
      expect(ggstatic.commands.size).toBe(0);
    });

    it('registers once the dev console appears later, and works without it', async () => {
      await screens.push(new MenuScreen('menu', log));
      const ggstatic = fakeGgstatic();
      (window as any).ggstatic = ggstatic;
      window.dispatchEvent(new Event('ggstatic_added'));
      expect([...ggstatic.commands.keys()].sort()).toEqual(['screen_pop', 'screens']);
    });
  });

  describe('leaks', () => {
    it('leaves nothing behind after many menu -> game -> pause -> menu round trips', async () => {
      const live = () => {
        const add = (target: any) => jest.spyOn(target, 'addEventListener');
        const remove = (target: any) => jest.spyOn(target, 'removeEventListener');
        return [add(window), remove(window), add(document), remove(document)];
      };
      const balance = (spies: jest.SpyInstance[]) => {
        const count = (spy: jest.SpyInstance) => spy.mock.calls.length;
        return [count(spies[0]) - count(spies[1]), count(spies[2]) - count(spies[3])];
      };

      await screens.push(new MenuScreen('menu', log));
      const worldsBefore = GgWorld.documentWorlds.length;
      const spies = live();
      const subscriptions: { closed: boolean }[] = [];
      const worlds: MockWorld[] = [];

      for (let i = 0; i < 25; i++) {
        const game = new WorldScreen(`game ${i}`, log);
        await screens.push(game, { clearHistory: true });
        worlds.push(game.world);
        subscriptions.push(game.world.keyboardInput.bind('Space').subscribe());
        // a screen-level shortcut, the way a game screen opens its pause menu
        game.keyboard.bind('Escape').subscribe();
        // pause overlay over the game (keyboard, then again like the touch button would), and back
        await screens.push(new LogScreen('pause', log));
        await screens.pop();
        await screens.push(new LogScreen('pause', log));
        await screens.reset([new MenuScreen('menu', log)]);
      }

      expect(GgWorld.documentWorlds.length).toBe(worldsBefore);
      expect(balance(spies)).toEqual([0, 0]);
      expect(screens.stack).toHaveLength(1);
      expect(screens.container.children).toHaveLength(1);
      for (const world of worlds) {
        expect(world.keyboardInput.running).toBe(false);
        expect((world as any)._inputEnabled$.observed).toBe(false);
      }
      jest.restoreAllMocks();
    });

    it('dispose exits every screen and removes the container it created', async () => {
      const manager = new ScreenManager({ loadingView: null });
      await manager.push(new WorldScreen('game', log));
      await manager.push(new LogScreen('pause', log));
      const container = manager.container;
      expect(container.isConnected).toBe(true);
      log.length = 0;

      await manager.dispose();

      expect(log).toEqual(['exit pause', 'teardown pause', 'exit game', 'teardown game']);
      expect(container.isConnected).toBe(false);
      await expect(manager.push(new LogScreen('late', log))).rejects.toThrow('disposed');
    });

    it('leaves a container it was given in place, empty', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const manager = new ScreenManager({ container, loadingView: null });
      await manager.push(new LogScreen('a', log));
      await manager.dispose();
      expect(container.isConnected).toBe(true);
      expect(container.children).toHaveLength(0);
      container.remove();
    });
  });
});
