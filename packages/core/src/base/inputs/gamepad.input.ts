import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { distinctUntilChanged, filter, map, startWith, take } from 'rxjs/operators';
import { IInput } from './i-input';
import { KeyboardInput } from './keyboard.input';
import { DirectionInput } from './direction.input';
import { Point2 } from '../models/points';
import { GgGlobalClock } from '../clock/global-clock';

/**
 * One control of a gamepad, by index: a button (`'b7'`) or one direction of an axis (`'a0-'`,
 * `'a0+'`). On a gamepad the browser knows (`navigator.getGamepads()[i].mapping === 'standard'`,
 * see https://w3c.github.io/gamepad/#remapping) `b0` is A/Cross, `b1` B/Circle, `b2` X/Square,
 * `b3` Y/Triangle, `b4`/`b5` the bumpers, `b6`/`b7` the triggers, `b8` Back, `b9` Start, `b10`/`b11`
 * the stick clicks, `b12`-`b15` the d-pad (up, down, left, right), `a0`/`a1` the left stick and
 * `a2`/`a3` the right one, with `-` to the left or up. A gamepad without the standard mapping (a
 * DirectInput pad on Windows, say) numbers its buttons differently; `GamepadInput.standardMapping`
 * tells which case a connected gamepad is.
 */
export type GamepadControl = string;

/** One or several controls that do the same thing: the most pushed one counts */
export type GamepadControls = GamepadControl | readonly GamepadControl[];

/** One axis of a direction, as the controls pushing it each way: `'a0-'`/`'a0+'`, or `'b14'`/`'b15'` */
export type GamepadAxisBinding = { negative: GamepadControls; positive: GamepadControls };

/**
 * A direction read from a gamepad, as `DirectionInput` reports it: `x` positive to the right, `y`
 * positive up/forward. An omitted axis stays 0.
 */
export type GamepadDirectionBinding = { x?: GamepadAxisBinding; y?: GamepadAxisBinding };

/** The left stick (`a0`/`a1`) as a direction, up positive */
export const GAMEPAD_LEFT_STICK: GamepadDirectionBinding = {
  x: { negative: 'a0-', positive: 'a0+' },
  y: { negative: 'a1+', positive: 'a1-' },
};

/** The right stick (`a2`/`a3`) as a direction, up positive */
export const GAMEPAD_RIGHT_STICK: GamepadDirectionBinding = {
  x: { negative: 'a2-', positive: 'a2+' },
  y: { negative: 'a3+', positive: 'a3-' },
};

/** The d-pad (`b12`-`b15`) as a direction */
export const GAMEPAD_DPAD: GamepadDirectionBinding = {
  x: { negative: 'b14', positive: 'b15' },
  y: { negative: 'b13', positive: 'b12' },
};

/** The left stick or the d-pad as a direction: what the built-in controllers move by */
export const GAMEPAD_LEFT_STICK_OR_DPAD: GamepadDirectionBinding = {
  x: { negative: ['a0-', 'b14'], positive: ['a0+', 'b15'] },
  y: { negative: ['a1+', 'b13'], positive: ['a1-', 'b12'] },
};

/**
 * The keys a console-style menu is worked with, and the controls pressing them: the d-pad or the
 * left stick are the arrows, A (`b0`) is Enter, B (`b1`) is Escape. What `Screen.bindGamepadKeys`
 * binds by default.
 */
export const GAMEPAD_MENU_KEYS: Readonly<Record<string, GamepadControls>> = {
  ArrowUp: ['b12', 'a1-'],
  ArrowDown: ['b13', 'a1+'],
  ArrowLeft: ['b14', 'a0-'],
  ArrowRight: ['b15', 'a0+'],
  Enter: 'b0',
  Escape: 'b1',
};

/** How `GamepadInput.bindKeys` presses its keys */
export type GamepadBindKeysOptions = {
  /**
   * Press a key only when its control becomes pressed while `keyboard` runs, like a key of a real
   * keyboard: a control pushed while `keyboard` is stopped presses nothing until it is pushed
   * again. For a menu's keys - a button that closed one screen must not act on the screen shown
   * next. An edge binding also ignores a control already held when it is made or when this input
   * first starts. Every binding, edge or not, ignores a control held through a stop and restart of
   * this input, and one still held after `keyboard` let go of its key (stopped, reset): those count
   * from their next push, so the button that closes a pause menu does not act in the game.
   */
  edge?: boolean;
  /**
   * Codes that are pressed again while their control stays held, as a held key repeats: first
   * after `repeatDelay`, then every `repeatInterval` milliseconds - each time a release and a press
   * of the key. With `edge`, only as long as the keyboard holds the key from that press: not
   * after the keyboard stopped or reset its keys meanwhile.
   */
  repeat?: readonly string[];
  /** Milliseconds from the press to the first repeat. 350 by default. */
  repeatDelay?: number;
  /** Milliseconds between two repeats. 125 by default. */
  repeatInterval?: number;
};

export type GamepadInputOptions = {
  /**
   * Below this a stick axis reads as 0, and the rest of its travel is rescaled to 0..1, so a stick
   * at rest a little off center does not move anything. Default 0.12.
   */
  stickDeadzone: number;
  /** Below this a button's analog value (a trigger's) reads as 0. Default 0.02. */
  triggerDeadzone: number;
  /** A control pushed further than this counts as pressed (`pressed$`, `bindKeys`). Default 0.5. */
  pressThreshold: number;
  /**
   * Which gamepad to read, by its index in `navigator.getGamepads()`. `null` (the default) reads
   * `GamepadInput.selectedGamepad()`: the player's `GamepadInput.choice`, else the gamepad in use,
   * else the first connected gamepad with a button pressed, else the first with the standard
   * mapping, else the first connected one.
   */
  gamepadIndex: number | null;
};

/**
 * A gamepad the player picked, as plain data to save and restore: its `Gamepad.id`, and which of
 * the connected gamepads with that id it is (0 the first) for several of the same model. Unlike an
 * index in `navigator.getGamepads()`, it finds the same device again after a reconnect or a reload.
 */
export type GamepadChoice = { id: string; nth: number };

const DEFAULT_OPTIONS: GamepadInputOptions = {
  stickDeadzone: 0.12,
  triggerDeadzone: 0.02,
  pressThreshold: 0.5,
  gamepadIndex: null,
};

const CONTROL_FORMAT = /^(b\d+|a\d+[+-])$/;
/** an axis changed by less than this between two polls is the noise of a stick held still */
const AXIS_MOVE_THRESHOLD = 0.01;

const STANDARD_BUTTON_NAMES = [
  'A',
  'B',
  'X',
  'Y',
  'LB',
  'RB',
  'LT',
  'RT',
  'Back',
  'Start',
  'L3',
  'R3',
  'D-pad up',
  'D-pad down',
  'D-pad left',
  'D-pad right',
  'Home',
];
const STANDARD_STICK_NAMES = ['L stick', 'R stick'];

const asList = (controls: GamepadControls): readonly GamepadControl[] =>
  typeof controls === 'string' ? [controls] : controls;

/**
 * A gamepad, read through the Gamepad API. Every world has one (`world.gamepadInput`), running
 * while the world's `inputEnabled`; it polls `navigator.getGamepads()` on every frame of the global
 * clock - also while the world is paused, so a gamepad can unpause it - and reports its controls
 * by index (`GamepadControl`), with the stick and trigger dead zones applied.
 *
 * It feeds the other inputs rather than replacing them: `bindKeys` presses keys of a
 * `KeyboardInput` while buttons are held (so anything bound to those keys works from the gamepad
 * too), `bindDirection` adds a stick or the d-pad to a `DirectionInput` as an analog contribution.
 * The built-in input controllers do both for their own keys and directions (see each one's
 * `gamepad` option), so a game drives from a gamepad with no code of its own. For an action with
 * no key, `pressed$`/`value$` read a control directly.
 *
 * Browsers only list a gamepad once a button was pressed on it, so `connected` turns `true` on the
 * first press, not when the cable is plugged in.
 *
 * All running inputs share one read of `navigator.getGamepads()` per frame, so a second input
 * beside a world's (a `ScreenManager`'s, another world's) costs no second read.
 *
 * @example
 * ```ts
 * // a horn on the B button, a boost proportional to how far the right trigger is pulled
 * world.gamepadInput.pressed$('b1').subscribe(down => down && horn.play());
 * world.gamepadInput.value$('b7').subscribe(v => (car.boost = v));
 * // an app's own key, held by the X button
 * world.gamepadInput.bindKeys(world.keyboardInput, { KeyF: 'b2' });
 * // a controls menu: capture whatever the player pushes next
 * world.gamepadInput.controlPushed$.pipe(take(1)).subscribe(control => bindings.horn = control);
 * ```
 */
export class GamepadInput extends IInput {
  private static readonly _choice$: BehaviorSubject<GamepadChoice | null> = new BehaviorSubject<GamepadChoice | null>(
    null,
  );

  /**
   * The gamepad the player picked, read by every `GamepadInput` without a `gamepadIndex` of its
   * own - those of every world and any others - on its next poll. `null` (the default) reads the
   * gamepad in use: the one read so far, while it is connected, once it was used (a button
   * pressed, an axis moved from rest) - so a gamepad listed later (a button pressed on it) does not
   * take over mid-game - and before that the first connected gamepad with a button pressed, else
   * the first one with the standard mapping, else the first connected one. A choice whose model
   * (`id`) is not connected right now falls back the same way and is used again once it is; with
   * fewer pads of that model than `nth + 1` connected, the last of them is read - a browser cannot
   * tell two identical pads apart across a reconnect anyway, so the order among them is a guess.
   * Assigning a choice (`null` too) starts over. Not saved by the engine: store it (it is plain
   * data) and assign it back at startup.
   *
   * Some devices list themselves as gamepads without being one (a keyboard with a gamepad
   * interface, a wheel's separate pedals) and may come first: a controls menu letting the player
   * pick (`chooseNext`) is the way out.
   *
   * @example
   * ```ts
   * GamepadInput.choice = JSON.parse(localStorage.getItem('gamepad') || 'null');
   * GamepadInput.choice$.subscribe(choice => localStorage.setItem('gamepad', JSON.stringify(choice)));
   * // a controls menu: "< Xbox 360 Controller >", stepping through the connected gamepads
   * label.text = GamepadInput.gamepadName(GamepadInput.selectedGamepad());
   * nextButton.onclick = () => GamepadInput.chooseNext(1);
   * ```
   */
  public static get choice(): GamepadChoice | null {
    return GamepadInput._choice$.value;
  }

  public static set choice(value: GamepadChoice | null) {
    GamepadInput.inUseDevice = null;
    GamepadInput._choice$.next(value);
  }

  /**
   * The gamepad read by default (no `choice` connected) once it was used, told apart by index
   * and id: it stays the one read while it is connected. `null` until then, after a `choice` is
   * assigned, and once it is gone.
   */
  private static inUseDevice: { index: number; id: string } | null = null;

  /** The running inputs, polled together on every frame: one `navigator.getGamepads()` read for all */
  private static readonly runningInputs: Set<GamepadInput> = new Set<GamepadInput>();
  private static frameSubscription: Subscription | null = null;

  private static pollAll(): void {
    const gamepads = GamepadInput.connectedGamepads();
    for (const input of [...GamepadInput.runningInputs]) {
      if (input.running) {
        input.readGamepad(input.findGamepad(gamepads));
      }
    }
  }

  /** `choice`, on subscription and on every change */
  public static get choice$(): Observable<GamepadChoice | null> {
    return GamepadInput._choice$.asObservable();
  }

  /**
   * The connected gamepads, in the browser's order. Browsers list a gamepad only once a button was
   * pressed on it; a page whose permissions policy withholds the gamepad feature gets none.
   */
  public static connectedGamepads(): Gamepad[] {
    try {
      return (navigator.getGamepads?.() || []).filter((x): x is Gamepad => !!x && x.connected);
    } catch (e) {
      // a page whose permissions policy withholds the gamepad feature (an embedded game) throws
      // here on every call: no gamepad, then
      return [];
    }
  }

  /** The `GamepadChoice` that finds `gamepad` (a connected one) again */
  public static choiceOf(gamepad: Gamepad): GamepadChoice {
    const nth = GamepadInput.connectedGamepads()
      .filter(x => x.id === gamepad.id)
      .findIndex(x => x.index === gamepad.index);
    return { id: gamepad.id, nth: Math.max(0, nth) };
  }

  /**
   * The gamepad a `GamepadInput` without a `gamepadIndex` reads: `choice` if connected, else the
   * gamepad in use (see `choice`), else the first connected gamepad with a button pressed, else the
   * first with the standard mapping, else the first connected one; `null` with none connected
   */
  public static selectedGamepad(): Gamepad | null {
    return GamepadInput.select(GamepadInput.connectedGamepads());
  }

  /**
   * Sets `choice` to the connected gamepad after (`step` 1) or before (-1) the selected one,
   * wrapping around, and returns it; `null` with none connected
   */
  public static chooseNext(step: 1 | -1 = 1): Gamepad | null {
    const gamepads = GamepadInput.connectedGamepads();
    if (gamepads.length === 0) {
      return null;
    }
    const current = GamepadInput.select(gamepads);
    const index = current ? gamepads.indexOf(current) : -1;
    const next = gamepads[(index + step + gamepads.length) % gamepads.length];
    GamepadInput.choice = GamepadInput.choiceOf(next);
    return next;
  }

  /**
   * A gamepad's name for a menu: its `id` without what browsers add to it - Chromium's trailing
   * "(STANDARD GAMEPAD Vendor: 045e Product: 028e)" / "(XInput STANDARD GAMEPAD)" /
   * "(Vendor: 045e Product: 028e)", Firefox's "045e-028e-" prefix. Parentheses of the product
   * name itself ("Logitech (R) Gamepad F310") stay.
   */
  public static gamepadName(gamepad: Gamepad): string {
    return (
      gamepad.id
        .replace(
          /\s*\((?:(?:XInput\s+)?STANDARD GAMEPAD(?:\s+Vendor: \w+ Product: \w+)?|Vendor: \w+ Product: \w+)\)\s*$/i,
          '',
        )
        .replace(/^[0-9a-f]{1,4}-[0-9a-f]{1,4}-/i, '') || gamepad.id
    );
  }

  private static select(gamepads: Gamepad[]): Gamepad | null {
    const choice = GamepadInput._choice$.value;
    if (choice) {
      const same = gamepads.filter(x => x.id === choice.id);
      const chosen = same[Math.min(choice.nth, same.length - 1)];
      if (chosen) {
        return chosen;
      }
    }
    const current = GamepadInput.findInUse(gamepads);
    if (current) {
      return current;
    }
    // none used yet: the one a button is pressed on (and becomes the one in use), so a second pad
    // the player picked up is not ignored for an idle one listed first
    const pressed = gamepads.find(x => x.buttons.some(b => b.pressed));
    return pressed || gamepads.find(x => x.mapping === 'standard') || gamepads[0] || null;
  }

  /** The gamepad in use among `gamepads`, if it is connected */
  private static findInUse(gamepads: Gamepad[]): Gamepad | undefined {
    const inUse = GamepadInput.inUseDevice;
    return (inUse && gamepads.find(x => x.index === inUse.index && x.id === inUse.id)) || undefined;
  }

  public readonly options: GamepadInputOptions;

  /** after every poll, and after a stop (every control reads as released then) */
  private readonly polled$: Subject<void> = new Subject<void>();
  /** after every poll of the gamepad itself: not after a stop */
  private readonly read$: Subject<void> = new Subject<void>();
  private readonly _connected$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private readonly _inUse$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private readonly _controlPushed$: Subject<GamepadControl> = new Subject<GamepadControl>();

  private _gamepad: Gamepad | null = null;
  /**
   * whether the control values are those of a read of the gamepad: `false` until the first poll
   * and after a stop, when every control reads as released whatever the hand on the gamepad does
   */
  private hasRead: boolean = false;
  /** button values after the trigger dead zone */
  private buttons: number[] = [];
  /** raw axis values */
  private axes: number[] = [];
  /** raw axis values of the poll before, to tell a stick moved from one resting off center */
  private previousAxes: number[] = [];
  private pushedRaw: Set<GamepadControl> = new Set<GamepadControl>();
  /**
   * the gamepad read last, told apart by index and id (`Gamepad` objects are snapshots), kept over
   * a disconnection
   */
  private device: { index: number; id: string } | null = null;

  constructor(options: Partial<GamepadInputOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.onDeviceUsed = this.onDeviceUsed.bind(this);
  }

  /** Whether a gamepad was found on the last poll */
  public get connected(): boolean {
    return this._connected$.value;
  }

  public get connected$(): Observable<boolean> {
    return this._connected$.pipe(distinctUntilChanged());
  }

  /**
   * Whether the gamepad is the device the player uses: `true` from the first control pushed on it
   * (a button, or a stick moved past its dead zone - an axis at rest away from 0 does not count),
   * `false` again at the first real key press or pointer press, or when it is gone. Stopping the
   * input (the world's `inputEnabled` off, for a menu) keeps it - along with `connected`, `gamepad`
   * and `standardMapping`, which stay as of the last poll - so the menu can still show the
   * gamepad's button names in its hints.
   */
  public get inUse(): boolean {
    return this._inUse$.value;
  }

  public get inUse$(): Observable<boolean> {
    return this._inUse$.pipe(distinctUntilChanged());
  }

  /** The native gamepad as of the last poll, `null` while none is connected */
  public get gamepad(): Gamepad | null {
    return this._gamepad;
  }

  /** Whether the connected gamepad reports the standard mapping (`b0` is A, `a0` the left stick) */
  public get standardMapping(): boolean {
    return this._gamepad?.mapping === 'standard';
  }

  /**
   * Every control that became pushed (past half way, raw, no dead zone) on the last poll - for a
   * controls menu capturing the player's choice. An axis at rest away from 0 (a trigger reported
   * as an axis rests at -1) stays pushed and is never captured; only its other direction can be.
   */
  public get controlPushed$(): Observable<GamepadControl> {
    return this._controlPushed$.asObservable();
  }

  /** Whether `control` is a well-formed `GamepadControl` */
  public static isControl(control: string): control is GamepadControl {
    return CONTROL_FORMAT.test(control);
  }

  /**
   * A short name of a control for menus: "A", "RT", "L stick left" with the standard mapping,
   * "Button 12" / "Axis 3+" without it
   */
  public static controlName(control: GamepadControl, standard: boolean = true): string {
    const index = parseInt(control.slice(1), 10);
    if (control[0] === 'b') {
      return (standard && STANDARD_BUTTON_NAMES[index]) || `Button ${index + 1}`;
    }
    const negative = control.endsWith('-');
    const stick = standard && STANDARD_STICK_NAMES[index >> 1];
    if (!stick) {
      return `Axis ${index + 1}${negative ? '-' : '+'}`;
    }
    const direction = index % 2 === 0 ? (negative ? 'left' : 'right') : negative ? 'up' : 'down';
    return `${stick} ${direction}`;
  }

  /**
   * How far a control is pushed as of the last poll, 0 to 1: a button's analog value (a trigger),
   * 1 for a pressed digital button, a stick axis past its dead zone rescaled to 0..1. Of several
   * controls, the most pushed one.
   */
  public value(controls: GamepadControls): number {
    let result = 0;
    for (const control of asList(controls)) {
      result = Math.max(result, this.controlValue(control));
    }
    return result;
  }

  /** `value(controls)` on subscription and after every poll it changed on */
  public value$(controls: GamepadControls): Observable<number> {
    return this.polled$.pipe(
      startWith(undefined),
      map(() => this.value(controls)),
      distinctUntilChanged(),
    );
  }

  /** Whether any of `controls` is pushed past `pressThreshold` */
  public pressed(controls: GamepadControls): boolean {
    return this.value(controls) > this.options.pressThreshold;
  }

  /** `pressed(controls)` on subscription and after every poll it changed on: a button's down/up */
  public pressed$(controls: GamepadControls): Observable<boolean> {
    return this.polled$.pipe(
      startWith(undefined),
      map(() => this.pressed(controls)),
      distinctUntilChanged(),
    );
  }

  /**
   * Emits once, when `controls` are read released: on subscription if they are, else on the first
   * poll none of them is pushed on. Only a poll counts, so while this input is stopped (the
   * world's `inputEnabled` off, for a controls menu), and between a start and its first poll -
   * every control reads as released then, which says nothing about the hand on the gamepad - it
   * waits for a poll after the restart. For a
   * control a menu captured, still held when it is assigned: what to act on it only from its next
   * push waits on this (`followGamepadKey`, `followGamepadPressed`).
   */
  public released$(controls: GamepadControls): Observable<void> {
    return this.read$.pipe(
      startWith(undefined),
      filter(() => this.hasRead && !this.pressed(controls)),
      take(1),
      map(() => undefined),
    );
  }

  /** The direction `binding` points as of the last poll, each axis `positive - negative` in [-1, 1] */
  public direction(binding: GamepadDirectionBinding): Point2 {
    const axis = (b: GamepadAxisBinding | undefined) => (b ? this.value(b.positive) - this.value(b.negative) : 0);
    return { x: axis(binding.x), y: axis(binding.y) };
  }

  /** `direction(binding)` on subscription and after every poll it changed on */
  public direction$(binding: GamepadDirectionBinding): Observable<Point2> {
    return this.polled$.pipe(
      startWith(undefined),
      map(() => this.direction(binding)),
      distinctUntilChanged((a, b) => a.x === b.x && a.y === b.y),
    );
  }

  /**
   * Holds keys of `keyboard` down while gamepad controls are pressed: `keys` maps a key code to
   * the control(s) that press it (`{ Space: 'b0', KeyE: ['b2', 'b5'] }`). The key goes down through
   * `emulateKeyDown` on the poll a control passes `pressThreshold` and up when none of them is
   * pressed any more - or when this input stops. Returns a function that unbinds (and releases).
   * While a key is held this way, releasing the same physical key, or another binding's hold of the
   * same key (a touch button, another controller's gamepad button), does not let go of it.
   * `options` make it press like a key of a real keyboard (`edge`) and repeat held keys (`repeat`),
   * for a menu.
   */
  public bindKeys(
    keyboard: KeyboardInput,
    keys: Readonly<Record<string, GamepadControls>>,
    options: GamepadBindKeysOptions = {},
  ): () => void {
    const edge = !!options.edge;
    const repeating = new Set(options.repeat || []);
    const repeatDelay = options.repeatDelay ?? 350;
    const repeatInterval = options.repeatInterval ?? 125;
    // the keys this binding holds down, and the controls pressed as of the last poll
    const held = new Set<string>();
    const down = new Set<string>();
    const nextRepeat = new Map<string, number>();
    // this binding's own hold on each key, so letting go here never releases another holder's
    const holder = {};
    // controls held while `keyboard` let go of their key: nothing until they are pushed again
    const waiting = new Set<string>();
    // what is held at the first read of the gamepad after this input stopped was not pushed now:
    // the values before that read are empty, not the state of the gamepad. With `edge` the same
    // goes for the first read after the binding was made
    let awaitingRead = true;
    let stopped = false;
    const update = (initial: boolean) => {
      const now = performance.now();
      const afterStop = stopped && this.hasRead;
      stopped = (stopped && !this.hasRead) || (!initial && !this.hasRead);
      const baseline = afterStop || (edge && (initial || awaitingRead));
      awaitingRead = !this.hasRead;
      for (const code of Object.keys(keys)) {
        const pressed = this.pressed(keys[code]);
        const wasDown = down.has(code);
        if (!pressed) {
          down.delete(code);
          waiting.delete(code);
          nextRepeat.delete(code);
          if (held.delete(code)) {
            keyboard.emulateKeyUp(code, holder);
          }
          continue;
        }
        down.add(code);
        if (held.has(code) && !keyboard.isHeldBy(code, holder)) {
          // let go of by the keyboard (stopped, restarted, reset): nothing more until the control
          // is pushed again
          held.delete(code);
          nextRepeat.delete(code);
          waiting.add(code);
        }
        if (!wasDown && (baseline || (edge && !keyboard.running))) {
          waiting.add(code);
        }
        if (waiting.has(code)) {
          continue;
        }
        if (!wasDown) {
          if (repeating.has(code)) {
            nextRepeat.set(code, now + repeatDelay);
          }
          held.add(code);
          keyboard.emulateKeyDown(code, holder);
        }
        const repeatAt = nextRepeat.get(code);
        if (held.has(code) && repeatAt !== undefined && now >= repeatAt) {
          // a stalled frame catches up with one repeat, not a burst of them
          const next = repeatAt + repeatInterval;
          nextRepeat.set(code, next > now ? next : now + repeatInterval);
          keyboard.emulateKeyUp(code, holder);
          keyboard.emulateKeyDown(code, holder);
        }
      }
    };
    const subscription = this.polled$.subscribe(() => update(false));
    update(true);
    return () => {
      subscription.unsubscribe();
      for (const code of held) {
        keyboard.emulateKeyUp(code, holder);
      }
      held.clear();
    };
  }

  /**
   * Adds `binding`'s direction to `direction` as an analog contribution (`setAnalogDirection`),
   * refreshed on every poll while it is not zero and withdrawn when it returns to zero - or when
   * this input stops. Returns a function that unbinds (and withdraws).
   */
  public bindDirection(direction: DirectionInput, binding: GamepadDirectionBinding): () => void {
    const source = {};
    let set = false;
    const update = () => {
      const d = this.direction(binding);
      const nonZero = d.x !== 0 || d.y !== 0;
      if (nonZero) {
        // set on every poll, not only on change: a direction input restarted meanwhile has dropped
        // the contribution, and gets it back this way
        direction.setAnalogDirection(source, d);
        set = true;
      } else if (set) {
        direction.setAnalogDirection(source, null);
        set = false;
      }
    };
    const subscription = this.polled$.subscribe(update);
    update();
    return () => {
      subscription.unsubscribe();
      if (set) {
        direction.setAnalogDirection(source, null);
        set = false;
      }
    };
  }

  /**
   * Reads the gamepad now. Done on every frame while running; call it yourself to read between
   * frames or from a test (with `navigator.getGamepads` stubbed).
   */
  public poll(): void {
    if (!this.running) {
      return;
    }
    this.readGamepad(this.findGamepad(GamepadInput.connectedGamepads()));
  }

  protected startInternal(): void {
    window.addEventListener('keydown', this.onDeviceUsed);
    window.addEventListener('pointerdown', this.onDeviceUsed);
    GamepadInput.runningInputs.add(this);
    if (!GamepadInput.frameSubscription) {
      GamepadInput.frameSubscription = GgGlobalClock.instance.tick$.subscribe(() => GamepadInput.pollAll());
    }
  }

  protected stopInternal(): void {
    window.removeEventListener('keydown', this.onDeviceUsed);
    window.removeEventListener('pointerdown', this.onDeviceUsed);
    GamepadInput.runningInputs.delete(this);
    if (GamepadInput.runningInputs.size === 0) {
      GamepadInput.frameSubscription?.unsubscribe();
      GamepadInput.frameSubscription = null;
    }
    // every binding lets go of what it holds: every control reads as released. The gamepad itself
    // stays known (`connected`, `standardMapping`, `inUse`), so a menu shown while the world's input
    // is off still names its buttons, and nothing on `connected$` flickers over the stop
    this.hasRead = false;
    this.buttons = [];
    this.axes = [];
    this.previousAxes = [];
    this.pushedRaw = new Set<GamepadControl>();
    this.polled$.next();
  }

  private findGamepad(gamepads: Gamepad[]): Gamepad | null {
    if (this.options.gamepadIndex === null) {
      if (GamepadInput.inUseDevice && !GamepadInput.findInUse(gamepads)) {
        // the gamepad in use is gone: forgotten by a poll only, never by a menu reading
        // `selectedGamepad()` during a momentary disconnection
        GamepadInput.inUseDevice = null;
      }
      return GamepadInput.select(gamepads);
    }
    const index = this.options.gamepadIndex;
    return gamepads.find(x => x.index === index) ?? null;
  }

  private readGamepad(gamepad: Gamepad | null): void {
    this._gamepad = gamepad;
    this.hasRead = true;
    const pushed = new Set<GamepadControl>();
    this.previousAxes = this.axes;
    if (gamepad) {
      this.buttons = gamepad.buttons.map(b => {
        if (b.value > this.options.triggerDeadzone) {
          return Math.min(1, b.value);
        }
        return b.pressed ? 1 : 0;
      });
      this.axes = Array.from(gamepad.axes);
      gamepad.buttons.forEach((b, i) => (b.pressed || b.value > 0.5) && pushed.add(`b${i}`));
      gamepad.axes.forEach((v, i) => Math.abs(v) > 0.5 && pushed.add(`a${i}${v < 0 ? '-' : '+'}`));
    } else {
      this.buttons = [];
      this.axes = [];
    }
    // a button pressed, or an axis moved from where it rests (a trigger reported as an axis rests
    // at -1, and pedals listed as a gamepad rest pushed)
    const used = !!gamepad && (this.buttons.some(v => v > 0) || this.axes.some((v, i) => this.axisMoved(v, i)));
    // switched to another gamepad while one was connected (a new choice): what is already held on
    // the new one was not pushed now, and a controls menu capturing a control must not take it. A
    // gamepad read after none was (the first ever, or one plugged back in) is no switch, so a
    // "press any button" menu gets the press that made the browser list it
    const device = gamepad && { index: gamepad.index, id: gamepad.id };
    const switched =
      !!device &&
      !!this.device &&
      this._connected$.value &&
      (device.index !== this.device.index || device.id !== this.device.id);
    if (device) {
      this.device = device;
      if (used && this.options.gamepadIndex === null && !GamepadInput.inUseDevice) {
        // the gamepad read by default was used: it stays the one read while connected (see `choice`)
        GamepadInput.inUseDevice = device;
      }
    }
    const newlyPushed = switched ? [] : [...pushed].filter(c => !this.pushedRaw.has(c));
    this.pushedRaw = pushed;
    this._connected$.next(!!gamepad);
    if (!gamepad) {
      this._inUse$.next(false);
    } else if (used) {
      this._inUse$.next(true);
    }
    this.polled$.next();
    this.read$.next();
    for (const control of newlyPushed) {
      this._controlPushed$.next(control);
    }
  }

  /**
   * Whether axis `i` is pushed past its dead zone and moved since the poll before: a trigger
   * reported as an axis rests at -1 and must not count as used until it is pulled
   */
  private axisMoved(value: number, i: number): boolean {
    if (Math.abs(value) <= this.options.stickDeadzone) {
      return false;
    }
    const previous = this.previousAxes[i];
    return previous !== undefined && Math.abs(value - previous) > AXIS_MOVE_THRESHOLD;
  }

  private controlValue(control: GamepadControl): number {
    const index = parseInt(control.slice(1), 10);
    if (control[0] === 'b') {
      return this.buttons[index] || 0;
    }
    const value = (this.axes[index] || 0) * (control.endsWith('-') ? -1 : 1);
    const deadzone = this.options.stickDeadzone;
    return value <= deadzone ? 0 : Math.min(1, (value - deadzone) / (1 - deadzone));
  }

  private onDeviceUsed(): void {
    this._inUse$.next(false);
  }
}
