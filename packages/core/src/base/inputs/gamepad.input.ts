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
   * Below this an axis (measured from where it rests, see `value`) reads as 0, and the rest of its
   * travel is rescaled to 0..1, so a stick at rest a little off center does not move anything.
   * Default 0.12.
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

/**
 * A connected gamepad told apart from the others: its position in `navigator.getGamepads()` and
 * its `Gamepad.id`. `Gamepad` objects are snapshots, never compared by identity.
 */
type GamepadDevice = { index: number; id: string };

const sameDevice = (a: GamepadDevice | null | undefined, b: GamepadDevice | null | undefined): boolean =>
  !!a && !!b && a.index === b.index && a.id === b.id;

/**
 * A rumble effect for `GamepadInput.rumble`: how hard each motor turns, 0 to 1 (clamped), for how
 * many milliseconds - or `Infinity` for an effect held until `stopRumble`, the next effect, the
 * input stopping or a change of gamepad (an engine, a rough road). `strong` is the heavy,
 * low-frequency motor (usually the left grip), `weak` the light, high-frequency one (the right
 * grip). `leftTrigger` and `rightTrigger` drive the motors in the triggers of gamepads that have
 * them (Xbox impulse triggers, `trigger-rumble`: Chromium on Windows); on any other gamepad they
 * are ignored and the grip motors play alone - an effect for the triggers alone is ignored there,
 * and leaves what plays untouched.
 */
export type GamepadRumble = {
  strong: number;
  weak: number;
  duration: number;
  leftTrigger?: number;
  rightTrigger?: number;
};

/** what TS's DOM types lack: the effects an actuator plays (Chromium, Safari) */
type RumbleActuator = GamepadHapticActuator & { readonly effects?: readonly string[] };

/** The longest effect browsers play: Chromium rejects anything longer */
const MAX_RUMBLE_MS = 5000;
/** a held effect (`duration: Infinity`) is played this long... */
const HELD_RUMBLE_EFFECT_MS = 1000;
/** ...and played again from the poll once this old, so a game that stops polling ends it by itself */
const HELD_RUMBLE_RENEW_MS = 500;

const clampMagnitude = (value: number | undefined): number => Math.min(1, Math.max(0, value || 0));

/**
 * Settles `promise` quietly. A `playEffect` promise rejects for parameters the gamepad refuses or a
 * gamepad gone meanwhile (a preempted effect resolves with `"preempted"`, no rejection); nothing an
 * app can act on, and from an effect renewed every tick it would be an unhandled rejection per tick
 */
const ignoreRejection = (promise: unknown): void => {
  Promise.resolve(promise).catch(() => {});
};

/** what `rumble` plays on one gamepad: its actuator and, for a held effect, what to play again */
type RumblingDevice = GamepadDevice & {
  actuator: RumbleActuator;
  /** the held effect (`duration: Infinity`) renewed from the poll, `null` for a one-shot effect */
  held: { type: string; params: GamepadEffectParameters } | null;
  /** `performance.now()` when the effect was last played */
  playedAt: number;
};

const DEFAULT_OPTIONS: GamepadInputOptions = {
  stickDeadzone: 0.12,
  triggerDeadzone: 0.02,
  pressThreshold: 0.5,
  gamepadIndex: null,
};

const CONTROL_FORMAT = /^(b\d+|a\d+[+-])$/;
/** an axis changed by less than this between two polls is the noise of a stick held still */
const AXIS_MOVE_THRESHOLD = 0.01;

/**
 * How far a control has to be pushed, raw, to count as pushed for `controlPushed$` - and how far an
 * axis has to sit from 0 when its gamepad is first seen to be taken as resting there
 */
const RAW_PUSH_THRESHOLD = 0.5;
/** the axes the standard mapping defines: two sticks, resting at 0 */
const STANDARD_STICK_AXES = 4;

/**
 * How far an axis reading `raw` sits from where it rests (`rest`, -1, 0 or 1), as a fraction 0..1
 * of the travel the axis has on that side of its rest: `|raw|` for one resting at 0, half the raw
 * distance for one resting at an end (a pedal's whole travel is two raw units). The one measure
 * the stick dead zone is applied to, in `value` and in `inUse`.
 */
const axisTravel = (raw: number, rest: number): number => Math.min(1, Math.abs(raw - rest) / (1 + Math.abs(rest)));

/**
 * Where the axes of `gamepad` from index `from` on rest, judged from how it reads now: the standard
 * mapping's sticks rest at 0 whatever is held; any other axis past half way rests at that end (a
 * trigger reported as an axis, a pedal), the rest at 0. Pure: nothing is remembered.
 */
const judgeAxisRests = (gamepad: Gamepad, from: number = 0): number[] => {
  const rests: number[] = [];
  for (let i = from; i < gamepad.axes.length; i++) {
    const v = gamepad.axes[i];
    const stick = gamepad.mapping === 'standard' && i < STANDARD_STICK_AXES;
    rests.push(!stick && Math.abs(v) > RAW_PUSH_THRESHOLD ? Math.sign(v) : 0);
  }
  return rests;
};

/** A gamepad seen on the page, told apart by index and id, and where each of its axes rests */
type KnownGamepad = {
  index: number;
  id: string;
  /** -1, 0 or 1 by axis index */
  rests: number[];
  /** learned on the poll going on: not seen before it */
  fresh: boolean;
};

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
 * by index (`GamepadControl`), with the stick and trigger dead zones applied. An axis is measured
 * from where it rests, learned per gamepad (`axisRest`): a stick from its centre, a pedal or a
 * trigger reported as an axis (resting at -1 or +1) from that end over its whole travel, and its
 * direction towards the rest is never pushed - so pedals listed as a gamepad never hold a menu's
 * arrow down.
 *
 * It feeds the other inputs rather than replacing them: `bindKeys` presses keys of a
 * `KeyboardInput` while buttons are held (so anything bound to those keys works from the gamepad
 * too), `bindDirection` adds a stick or the d-pad to a `DirectionInput` as an analog contribution.
 * The built-in input controllers do both for their own keys and directions (see each one's
 * `gamepad` option), so a game drives from a gamepad with no code of its own. For an action with
 * no key, `pressed$`/`value$` read a control directly. `rumble` plays the motors of the gamepad it
 * reads.
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
 * // a crash: both motors, a fifth of a second
 * world.gamepadInput.rumble({ strong: 1, weak: 0.6, duration: 200 });
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
    GamepadInput.choiceVersion++;
    GamepadInput._choice$.next(value);
  }

  /** counts the `choice` assignments, so an input tells whether its last poll predates the choice */
  private static choiceVersion: number = 0;

  /**
   * The gamepad read by default (no `choice` connected) once it was used, told apart by index
   * and id: it stays the one read while it is connected. `null` until then, after a `choice` is
   * assigned, and once it is gone.
   */
  private static inUseDevice: { index: number; id: string } | null = null;

  /**
   * The gamepads seen while connected, with where their axes rest (see `controlPushed$`): learned
   * on the first poll that lists one and kept over stops and switches, since what is held when an
   * input (re)starts says nothing about the rest. Forgotten by a poll that finds it gone.
   */
  private static readonly knownGamepads: KnownGamepad[] = [];

  /** The running inputs, polled together on every frame: one `navigator.getGamepads()` read for all */
  private static readonly runningInputs: Set<GamepadInput> = new Set<GamepadInput>();
  private static frameSubscription: Subscription | null = null;

  private static pollAll(): void {
    GamepadInput.pollGamepads([...GamepadInput.runningInputs]);
  }

  /** One read of the gamepads for `inputs`, keeping `knownGamepads` up to date around it */
  private static pollGamepads(inputs: GamepadInput[]): void {
    const gamepads = GamepadInput.connectedGamepads();
    const known = GamepadInput.knownGamepads;
    for (let i = known.length - 1; i >= 0; i--) {
      if (!gamepads.some(x => sameDevice(x, known[i]))) {
        // gone: plugged in again, it is learned again
        known.splice(i, 1);
      }
    }
    for (const input of inputs) {
      if (input.running) {
        input.readGamepad(input.findGamepad(gamepads));
      }
    }
    // a gamepad no input read is learned as well, while it is likely untouched: the browser has
    // just listed it, and nothing is driven with it yet
    for (const gamepad of gamepads) {
      GamepadInput.knownGamepad(gamepad);
    }
    for (const gamepad of known) {
      gamepad.fresh = false;
    }
    GamepadInput.renewHeldRumble();
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

  /**
   * Where axis `index` of `gamepad` (a connected one) rests, as the engine learned it: -1 or 1 for
   * an axis resting at an end (a pedal, a trigger reported as an axis), 0 for a stick - or for an
   * axis the gamepad lacks. Learned on the first poll that lists the gamepad (see `controlPushed$`
   * for the rule and its known gaps, `learnAxisRests` for the way to correct it); for a gamepad no
   * poll has seen yet the answer is judged from how it reads now and not remembered - the poll
   * learns it. Every `GamepadInput` measures the axis's values from this rest (`value`), so an app
   * needs it only to tell a pedal from a stick - to keep pedals from moving a menu cursor, say.
   *
   * @example
   * ```ts
   * // the menu's arrows on the left stick only when axis 1 is a stick, not a pedal
   * const pad = world.gamepadInput.gamepad;
   * const stick = !pad || GamepadInput.axisRest(pad, 1) === 0;
   * ```
   */
  public static axisRest(gamepad: Gamepad, index: number): number {
    const known = GamepadInput.knownGamepads.find(x => sameDevice(x, gamepad));
    const rests = known ? known.rests : judgeAxisRests(gamepad);
    return rests[index] || 0;
  }

  /**
   * Learns again where every axis of `gamepad` (a connected one) rests, from how it reads now, by
   * the rule of the first poll (`controlPushed$`): for a calibration step of the app's own - "let
   * go of every control, then press a button" - which is the way out when that poll got an axis
   * wrong (a stick of a gamepad without the standard mapping held past half way while the
   * browser listed it is taken as resting at that end, and then reads dead towards that end).
   * Every `GamepadInput` measures the axes from the new rests from its next poll on; the change
   * itself pushes nothing. `axisRest` answers the new rests at once.
   */
  public static learnAxisRests(gamepad: Gamepad): void {
    const known = GamepadInput.knownGamepad(gamepad);
    // in place: every input reading this gamepad holds the array
    known.rests.splice(0, known.rests.length, ...judgeAxisRests(gamepad));
  }

  /** `gamepad` in `knownGamepads`, added (`fresh`) with where its axes rest as it reads now if new */
  private static knownGamepad(gamepad: Gamepad): KnownGamepad {
    let known = GamepadInput.knownGamepads.find(x => sameDevice(x, gamepad));
    if (!known) {
      known = { index: gamepad.index, id: gamepad.id, rests: [], fresh: true };
      GamepadInput.knownGamepads.push(known);
    }
    const rests = known.rests;
    if (rests.length < gamepad.axes.length) {
      rests.push(...judgeAxisRests(gamepad, rests.length));
    }
    return known;
  }

  /**
   * The actuator `rumble` plays `dual-rumble` on, `null` for a gamepad without one: no motors, or a
   * browser without `playEffect` (Firefox)
   */
  private static rumbleActuator(gamepad: Gamepad | null): RumbleActuator | null {
    const actuator = gamepad?.vibrationActuator as RumbleActuator | null | undefined;
    if (!actuator || typeof actuator.playEffect !== 'function') {
      return null;
    }
    // `effects` lists what the actuator plays where the browser tells (Chromium, Safari)
    return !actuator.effects || actuator.effects.includes('dual-rumble') ? actuator : null;
  }

  /** Stops what `actuator` plays: `reset()`, else (a browser without it) an effect of no strength */
  private static resetActuator(actuator: RumbleActuator): void {
    try {
      if (typeof actuator.reset === 'function') {
        ignoreRejection(actuator.reset());
      } else {
        ignoreRejection(actuator.playEffect('dual-rumble', { duration: 1, strongMagnitude: 0, weakMagnitude: 0 }));
      }
    } catch (e) {
      // the gamepad is gone meanwhile
    }
  }

  /** `playEffect`, quietly: what the gamepad refuses is nothing an app can act on */
  private static playEffect(actuator: RumbleActuator, type: string, params: GamepadEffectParameters): void {
    try {
      ignoreRejection(actuator.playEffect(type as GamepadHapticEffectType, params));
    } catch (e) {
      // refused by the gamepad
    }
  }

  /**
   * The gamepads rumbling, by device: an actuator is the gamepad's, not an input's, so every input
   * reading a gamepad stops what plays on it (a paused world silences a rumble another world's
   * input started), and a held effect is renewed from the poll whichever input polls
   */
  private static readonly rumbling: RumblingDevice[] = [];

  /** Plays `type`/`params` on `device`'s `actuator`, replacing what it plays; `held` is renewed from the poll */
  private static playRumble(
    device: GamepadDevice,
    actuator: RumbleActuator,
    type: string,
    params: GamepadEffectParameters,
    held: boolean,
  ): void {
    let rumbling = GamepadInput.rumbling.find(x => sameDevice(x, device));
    if (!rumbling) {
      rumbling = { index: device.index, id: device.id, actuator, held: null, playedAt: 0 };
      GamepadInput.rumbling.push(rumbling);
    }
    rumbling.actuator = actuator;
    rumbling.held = held ? { type, params } : null;
    rumbling.playedAt = performance.now();
    GamepadInput.playEffect(actuator, type, params);
  }

  /** Stops the rumble on `device`, if any */
  private static stopRumbling(device: GamepadDevice | null): void {
    const i = GamepadInput.rumbling.findIndex(x => sameDevice(x, device));
    if (i >= 0) {
      const [rumbling] = GamepadInput.rumbling.splice(i, 1);
      GamepadInput.resetActuator(rumbling.actuator);
    }
  }

  /** Plays every held effect again before its last play ends (see `HELD_RUMBLE_RENEW_MS`) */
  private static renewHeldRumble(): void {
    const now = performance.now();
    for (const rumbling of GamepadInput.rumbling) {
      if (rumbling.held && now - rumbling.playedAt >= HELD_RUMBLE_RENEW_MS) {
        rumbling.playedAt = now;
        GamepadInput.playEffect(rumbling.actuator, rumbling.held.type, rumbling.held.params);
      }
    }
  }

  /** The gamepad in use among `gamepads`, if it is connected */
  private static findInUse(gamepads: Gamepad[]): Gamepad | undefined {
    return gamepads.find(x => sameDevice(x, GamepadInput.inUseDevice));
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
  /**
   * where each axis of the gamepad read last rests (-1, 0 or 1, see `axisRest`): what the axis
   * values are measured from in `controlValue`. The `KnownGamepad`'s own array (never copied, so a
   * `learnAxisRests` shows at once), empty while no gamepad is read
   */
  private axisRests: number[] = [];
  /** raw axis values of the poll before, to tell a stick moved from one held still */
  private previousAxes: number[] = [];
  private pushedRaw: Set<GamepadControl> = new Set<GamepadControl>();
  /**
   * the gamepad read last, told apart by index and id (`Gamepad` objects are snapshots), kept over
   * a disconnection
   */
  private device: GamepadDevice | null = null;
  /** `GamepadInput.choiceVersion` at the last read: a choice made since makes `_gamepad` stale */
  private readChoiceVersion: number = -1;
  /** the gamepad `rumble` aimed at last, until stopped */
  private rumbleTarget: GamepadDevice | null = null;

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
   * controls menu capturing the player's choice. What is held on the first read after this input
   * starts is not reported when the gamepad was seen before (the gas trigger held while a menu
   * opens); a gamepad seen for the first time reports it, since the browser lists a gamepad
   * because of a press on it, and a "press any button" menu waits for exactly that press.
   *
   * An axis's direction towards where it rests is never reported: a trigger reported as an axis
   * rests at -1, so pulling it reports `+` and letting it go reports nothing, however many times
   * it is pulled. A stick or a shared axis resting at 0 reports both directions.
   *
   * Where an axis rests is learned per gamepad on the first poll that lists it (by any running
   * `GamepadInput`): the standard mapping's sticks rest at 0, any other axis then past half way
   * rests at that end, the rest at 0 (`axisRest` reads it). The same rest is what `value`,
   * `pressed`, `direction` and the bindings measure the axis from. Disconnecting the gamepad
   * forgets it, so plugging it in again learns it again; `learnAxisRests` learns it again on
   * request, for a calibration step of the app's own. Known gaps, all on axes outside the
   * standard sticks: a trigger held on that poll is taken as resting pulled (its pull is then not
   * reported, its release is, and `value` reads its pull as 0), an axis held to one end on it never
   * reports that direction and reads dead towards it, and a trigger the browser reads as 0 until
   * it is first touched (seen on Linux) is taken as resting at 0, so its release reports `-` like
   * a push and `value` reads its release as a `-` push.
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
   * 1 for a pressed digital button, an axis measured from where it rests (`axisRest`): towards the
   * rest it reads 0, away from it the travel it has on that side - a stick's raw value, half the
   * raw distance for an axis resting at an end - past the stick dead zone rescaled to 0..1. So a
   * pedal learned as resting at -1 reads `a5+` 0 at rest, 0.5 half way (less the dead zone) and 1
   * floored, and `a5-` 0 for as long as that rest stands (`controlPushed$` has the gaps of the
   * learning, `learnAxisRests` the correction). Of several controls, the most pushed one.
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

  /**
   * Whether any of `controls` is pushed past `pressThreshold` - an axis measured from where it
   * rests (`value`): an axis resting at +1 never presses `+`, and presses `-` once its travel from
   * that end, past the stick dead zone and rescaled, exceeds the threshold (56% of the travel with
   * the default `stickDeadzone` and `pressThreshold`)
   */
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

  /**
   * The direction `binding` points as of the last poll, each axis `positive - negative` in [-1, 1],
   * every control measured from where its axis rests (`value`)
   */
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
   * Whether the gamepad this input reads (the one of the last poll; the one connected right now
   * before a poll or after a new `GamepadInput.choice`) has rumble motors the browser can play: a
   * `vibrationActuator` with `playEffect` and `dual-rumble`. `false` with no gamepad,
   * and in browsers without rumble (Firefox). Unlike `rumble`, it answers while this input is
   * stopped too, for a controls menu shown with the world's input off.
   */
  public get canRumble(): boolean {
    return !!GamepadInput.rumbleActuator(this.rumbleGamepad());
  }

  /**
   * Plays `effect` on the rumble motors of the gamepad this input reads (its `gamepadIndex`, else
   * the one `GamepadInput.selectedGamepad()` picks): the gamepad of the last poll, or - before the
   * first poll, or after a `GamepadInput.choice` made since - the one connected right now, so a
   * gamepad just chosen rumbles at once. The effect replaces the one playing; one with no strength
   * or no duration stops it. Magnitudes are clamped to 0..1, `duration` to 0..5000 ms (the longest
   * effect browsers play), or `Infinity` holds the effect: it is played again from every poll until
   * `stopRumble`, the next effect, this input stopping or a change of gamepad - a game that stops
   * polling (its tab hidden) ends it within a second by itself. Returns whether the gamepad can
   * rumble (`canRumble`); a stopped input plays nothing and returns `false`.
   *
   * The rumble stops with `stopRumble`, when this input stops (the world's `inputEnabled` off, for
   * a pause menu) and when the gamepad it reads changes (a new `choice`, the gamepad gone): the
   * old gamepad's motors stop. The motors are the gamepad's, not this input's: stopping here also
   * stops what another `GamepadInput` reading the same gamepad plays on it.
   *
   * This is rumble only, the Gamepad API's `dual-rumble` (and `trigger-rumble`, see
   * `GamepadRumble`): the force feedback of a steering wheel (springs, a constant force against
   * the hands) has no web API. What the browser refuses (no `dual-rumble` on the gamepad, an
   * effect preempted by the next one) is ignored.
   *
   * @example
   * ```ts
   * // a hit: a jolt of both motors
   * world.gamepadInput.rumble({ strong: 1, weak: 0.5, duration: 250 });
   * // a rough road: held while on it
   * world.gamepadInput.rumble({ strong: 0.3, weak: 0, duration: Infinity });
   * world.gamepadInput.stopRumble();
   * ```
   */
  public rumble(effect: GamepadRumble): boolean {
    if (!this.running) {
      return false;
    }
    const gamepad = this.rumbleGamepad();
    const actuator = GamepadInput.rumbleActuator(gamepad);
    if (!gamepad || !actuator) {
      this.stopRumble();
      return false;
    }
    if (this.rumbleTarget && !sameDevice(this.rumbleTarget, gamepad)) {
      // another gamepad than the one rumbling: that one stops
      this.stopRumble();
    }
    const held = effect.duration === Infinity;
    const duration = held
      ? HELD_RUMBLE_EFFECT_MS
      : Math.min(MAX_RUMBLE_MS, Math.max(0, Math.round(effect.duration || 0)));
    const strongMagnitude = clampMagnitude(effect.strong);
    const weakMagnitude = clampMagnitude(effect.weak);
    const leftTrigger = clampMagnitude(effect.leftTrigger);
    const rightTrigger = clampMagnitude(effect.rightTrigger);
    const triggersWanted = leftTrigger > 0 || rightTrigger > 0;
    const triggers = triggersWanted && !!actuator.effects?.includes('trigger-rumble');
    // what the gamepad will play: the trigger motors only where it has them
    const strength = strongMagnitude + weakMagnitude + (triggers ? leftTrigger + rightTrigger : 0);
    if (strength === 0 && triggersWanted) {
      // the trigger motors alone, on a gamepad without them: ignored, what plays goes on
      return true;
    }
    if (duration === 0 || strength === 0) {
      this.stopRumble();
      return true;
    }
    this.rumbleTarget = { index: gamepad.index, id: gamepad.id };
    GamepadInput.playRumble(
      this.rumbleTarget,
      actuator,
      triggers ? 'trigger-rumble' : 'dual-rumble',
      triggers
        ? { duration, strongMagnitude, weakMagnitude, leftTrigger, rightTrigger }
        : { duration, strongMagnitude, weakMagnitude },
      held,
    );
    return true;
  }

  /**
   * Stops the rumble on the gamepad this input reads (`vibrationActuator.reset()`): what this
   * input played, and what any other `GamepadInput` reading the same gamepad plays on it. Done by
   * itself when this input stops and when the gamepad it reads changes.
   */
  public stopRumble(): void {
    const target = this.rumbleTarget;
    this.rumbleTarget = null;
    GamepadInput.stopRumbling(target);
    if (!sameDevice(this.device, target)) {
      GamepadInput.stopRumbling(this.device);
    }
  }

  /**
   * The gamepad `rumble` and `canRumble` play on: the one read on the last poll, unless none was
   * read yet or `GamepadInput.choice` was assigned since - then the one connected right now
   */
  private rumbleGamepad(): Gamepad | null {
    if (this.hasRead && this.readChoiceVersion === GamepadInput.choiceVersion) {
      return this._gamepad;
    }
    return this.targetGamepad(GamepadInput.connectedGamepads());
  }

  /**
   * Reads the gamepad now. Done on every frame while running; call it yourself to read between
   * frames or from a test (with `navigator.getGamepads` stubbed).
   */
  public poll(): void {
    if (!this.running) {
      return;
    }
    GamepadInput.pollGamepads([this]);
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
    this.stopRumble();
    // every binding lets go of what it holds: every control reads as released. The gamepad itself
    // stays known (`connected`, `standardMapping`, `inUse`), so a menu shown while the world's input
    // is off still names its buttons, and nothing on `connected$` flickers over the stop
    this.hasRead = false;
    this.buttons = [];
    this.axes = [];
    this.axisRests = [];
    this.previousAxes = [];
    this.pushedRaw = new Set<GamepadControl>();
    this.polled$.next();
  }

  private findGamepad(gamepads: Gamepad[]): Gamepad | null {
    if (this.options.gamepadIndex === null && GamepadInput.inUseDevice && !GamepadInput.findInUse(gamepads)) {
      // the gamepad in use is gone: forgotten by a poll only, never by a menu reading
      // `selectedGamepad()` during a momentary disconnection
      GamepadInput.inUseDevice = null;
    }
    return this.targetGamepad(gamepads);
  }

  /** The gamepad among `gamepads` this input reads: `gamepadIndex`'s, else `select`'s. Pure. */
  private targetGamepad(gamepads: Gamepad[]): Gamepad | null {
    const index = this.options.gamepadIndex;
    return index === null ? GamepadInput.select(gamepads) : (gamepads.find(x => x.index === index) ?? null);
  }

  private readGamepad(gamepad: Gamepad | null): void {
    const firstRead = !this.hasRead;
    this._gamepad = gamepad;
    this.hasRead = true;
    this.readChoiceVersion = GamepadInput.choiceVersion;
    const pushed = new Set<GamepadControl>();
    this.previousAxes = this.axes;
    const known = gamepad && GamepadInput.knownGamepad(gamepad);
    const rests = known ? known.rests : [];
    if (gamepad) {
      this.buttons = gamepad.buttons.map(b => {
        if (b.value > this.options.triggerDeadzone) {
          return Math.min(1, b.value);
        }
        return b.pressed ? 1 : 0;
      });
      this.axes = Array.from(gamepad.axes);
      this.axisRests = rests;
      gamepad.buttons.forEach((b, i) => (b.pressed || b.value > RAW_PUSH_THRESHOLD) && pushed.add(`b${i}`));
      // an axis at rest away from 0 is pushed towards its rest, which is never a push
      gamepad.axes.forEach(
        (v, i) =>
          Math.abs(v) > RAW_PUSH_THRESHOLD && Math.sign(v) !== rests[i] && pushed.add(`a${i}${v < 0 ? '-' : '+'}`),
      );
    } else {
      this.buttons = [];
      this.axes = [];
      this.axisRests = [];
    }
    // a button pressed, or an axis moved away from where it rests (a trigger reported as an axis
    // rests at -1, and pedals listed as a gamepad rest pushed)
    const used =
      !!gamepad && (this.buttons.some(v => v > 0) || this.axes.some((v, i) => this.axisMoved(v, i, rests[i] || 0)));
    // switched to another gamepad while one was connected (a new choice): what is already held on
    // the new one was not pushed now, and a controls menu capturing a control must not take it. A
    // gamepad read after none was (the first ever, or one plugged back in) is no switch, so a
    // "press any button" menu gets the press that made the browser list it
    const device = gamepad && { index: gamepad.index, id: gamepad.id };
    if (this.rumbleTarget && !sameDevice(device, this.rumbleTarget)) {
      // the gamepad rumbling is not the one read any more: its motors stop
      GamepadInput.stopRumbling(this.rumbleTarget);
      this.rumbleTarget = null;
    }
    const switched = !!device && !!this.device && this._connected$.value && !sameDevice(device, this.device);
    if (device) {
      this.device = device;
      if (used && this.options.gamepadIndex === null && !GamepadInput.inUseDevice) {
        // the gamepad read by default was used: it stays the one read while connected (see `choice`)
        GamepadInput.inUseDevice = device;
      }
    }
    // the first read after a start, of a gamepad seen before: what is held was not pushed now either
    const baseline = switched || (firstRead && !!known && !known.fresh);
    const newlyPushed = baseline ? [] : [...pushed].filter(c => !this.pushedRaw.has(c));
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
   * Whether axis `i` is pushed past its dead zone away from `rest` - on the scale `value` applies
   * it, so a push `value` reads as 0 never counts as use - and moved since the poll before: a
   * trigger reported as an axis rests at -1 and must not count as used until it is pulled
   */
  private axisMoved(value: number, i: number, rest: number): boolean {
    if (axisTravel(value, rest) <= this.options.stickDeadzone) {
      return false;
    }
    const previous = this.previousAxes[i];
    return previous !== undefined && Math.abs(value - previous) > AXIS_MOVE_THRESHOLD;
  }

  /**
   * How far `control` is pushed as of the last read, 0..1. An axis is measured from where it rests
   * (`axisRests`, see `axisRest`): towards the rest it reads 0, away from it its travel on that side
   * (`axisTravel`) - a pedal resting at -1 reads `+` as 0 at rest, 0.5 half way and 1 floored, and
   * `-` as 0; an axis resting at 0 (a stick) reads as its raw value. Then the stick dead zone.
   */
  private controlValue(control: GamepadControl): number {
    const index = parseInt(control.slice(1), 10);
    if (control[0] === 'b') {
      return this.buttons[index] || 0;
    }
    const raw = this.axes[index];
    if (raw === undefined) {
      return 0;
    }
    const rest = this.axisRests[index] || 0;
    const towardsRest = control.endsWith('-') ? rest < 0 || raw >= rest : rest > 0 || raw <= rest;
    const value = towardsRest ? 0 : axisTravel(raw, rest);
    const deadzone = this.options.stickDeadzone;
    return value <= deadzone ? 0 : Math.min(1, (value - deadzone) / (1 - deadzone));
  }

  private onDeviceUsed(): void {
    this._inUse$.next(false);
  }
}
