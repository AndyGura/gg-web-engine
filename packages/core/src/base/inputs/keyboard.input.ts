import { IInput } from './i-input';
import { BehaviorSubject, combineLatest, finalize, NEVER, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

/**
 * Codes `KeyboardInput.isBindable` refuses: browser and OS keys (Tab moves the focus, Escape
 * leaves pointer lock and fullscreen, F5 reloads, Ctrl/Alt/Meta turn the other held keys into
 * shortcuts: Ctrl+W closes the tab), lock keys (macOS reports Caps Lock only when it toggles),
 * media, power and IME keys, and codes of no physical key
 */
const UNBINDABLE_KEY_CODES =
  /^(|Unidentified|Escape|Tab|Meta(Left|Right)|OS(Left|Right)|Control(Left|Right)|Alt(Left|Right)|ContextMenu|CapsLock|NumLock|ScrollLock|PrintScreen|Fn|FnLock|F\d+|Audio\w+|Media\w+|Browser\w+|Launch\w+|Power|Sleep|WakeUp|Eject|Help|Lang\d|KanaMode|Convert|NonConvert|Hiragana|Katakana)$/;

/**
 * Names of keys that print nothing, or print a character that says less than the name. A `Map`,
 * not an object: a code from saved data may be `'constructor'`, which an object has
 */
const SPECIAL_KEY_NAMES: ReadonlyMap<string, string> = new Map<string, string>([
  ['ArrowLeft', 'Left'],
  ['ArrowRight', 'Right'],
  ['ArrowUp', 'Up'],
  ['ArrowDown', 'Down'],
  ['ShiftLeft', 'L Shift'],
  ['ShiftRight', 'R Shift'],
  ['ControlLeft', 'L Ctrl'],
  ['ControlRight', 'R Ctrl'],
  ['AltLeft', 'L Alt'],
  ['AltRight', 'R Alt'],
  ['MetaLeft', 'L Meta'],
  ['MetaRight', 'R Meta'],
  ['Space', 'Space'],
  ['Enter', 'Enter'],
  ['Tab', 'Tab'],
  ['Escape', 'Esc'],
  ['Backspace', 'Backspace'],
  ['CapsLock', 'Caps Lock'],
  ['Delete', 'Del'],
  ['Insert', 'Ins'],
  ['Home', 'Home'],
  ['End', 'End'],
  ['PageUp', 'PgUp'],
  ['PageDown', 'PgDn'],
  ['NumpadEnter', 'Num Enter'],
  ['NumpadAdd', 'Num +'],
  ['NumpadSubtract', 'Num -'],
  ['NumpadMultiply', 'Num *'],
  ['NumpadDivide', 'Num /'],
  ['NumpadDecimal', 'Num .'],
  ['NumpadEqual', 'Num ='],
  ['NumpadComma', 'Num ,'],
]);

/**
 * Characters the punctuation keys print in the US layout, for when the browser can't tell the
 * player's layout
 */
const US_LAYOUT_KEY_NAMES: ReadonlyMap<string, string> = new Map<string, string>([
  ['Backquote', '`'],
  ['Minus', '-'],
  ['Equal', '='],
  ['BracketLeft', '['],
  ['BracketRight', ']'],
  ['Backslash', '\\'],
  ['IntlBackslash', '\\'],
  ['Semicolon', ';'],
  ['Quote', "'"],
  ['Comma', ','],
  ['Period', '.'],
  ['Slash', '/'],
]);

/**
 * What each key prints in the player's keyboard layout, as of the last `loadKeyboardLayout`
 */
let keyboardLayoutMap: ReadonlyMap<string, string> | null = null;
let keyboardLayoutRequested: boolean = false;

/**
 * A main keyboard input: it does not have own key bindings, but provides an API to bind keys.
 * It is responsible for listening key up/down events (when running!) and emit the events to subscribers.
 * Every World entity has its own dedicated instance of Keyboard input, which is running only when the world is running
 *
 * @example
 * ```ts
 * // each world has one: world.keyboardInput. Codes are KeyboardEvent.code values.
 * world.keyboardInput.bind('KeyF').subscribe(pressed => {
 *   if (pressed) flashlight.visible = !flashlight.visible;
 * });
 * // several keys for one action: true while any of them is held
 * world.keyboardInput.bindMany('ShiftLeft', 'ShiftRight').subscribe(held => (player.isRunning = held));
 * // an on-screen button can press a key the same way
 * button.onclick = () => world.keyboardInput.emulateKeyPress('KeyF');
 * ```
 */
export class KeyboardInput extends IInput {
  private bindings: { [code: string]: BehaviorSubject<boolean>[] } = {};
  /**
   * Codes held down through `emulateKeyDown` and not yet let go of through `emulateKeyUp`, with the
   * holders (the `holder` argument, or `defaultHolder` without one) still holding each: a real keyup
   * of such a code is not a release, nor is an `emulateKeyUp` by one holder while another holds it
   */
  private emulatedHeld: Map<string, Set<unknown>> = new Map<string, Set<unknown>>();
  /**
   * The holder an `emulateKeyDown`/`emulateKeyUp` call without a `holder` counts as
   */
  private readonly defaultHolder: unknown = {};
  /**
   * Codes held down on the physical keyboard (a real keydown, no keyup yet): an `emulateKeyUp` of
   * such a code is not a release either, the finger on the key still holds it
   */
  private physicalHeld: Set<string> = new Set<string>();

  /**
   * Flag which disables handling key downs, when document has some "typeable" element focused
   */
  public skipKeyDownsOnExternalFocus: boolean = true;

  /**
   * Which element types should filter key downs when focused
   */
  public static externalFocusBlacklist: { new (): HTMLElement }[] = [
    HTMLInputElement,
    HTMLTextAreaElement,
    HTMLSelectElement,
    HTMLButtonElement,
  ];

  /**
   * A short name of a key for a menu or an on-screen hint: `'W'`, `'Left'`, `'Space'`, `'Num 8'`,
   * `'L Shift'`. A key that prints a character shows the character of the player's keyboard
   * layout where the browser tells it (Chromium, through `navigator.keyboard.getLayoutMap()`), so
   * `KeyQ` reads "A" on an AZERTY keyboard; elsewhere, the US layout's. The layout is loaded on
   * the first call, so the very first names may still be the US ones: await `loadKeyboardLayout()`
   * before showing a menu to have them right from the start.
   * @param code A `KeyboardEvent.code` value
   */
  public static keyName(code: string): string {
    if (!keyboardLayoutRequested) {
      KeyboardInput.loadKeyboardLayout();
    }
    const special = SPECIAL_KEY_NAMES.get(code);
    if (special) {
      return special;
    }
    const printed = keyboardLayoutMap?.get(code);
    if (printed && printed.trim()) {
      // a label of one character stays one: 'ß'.toUpperCase() is 'SS'
      const upper = printed.toUpperCase();
      return upper.length === printed.length ? upper : printed;
    }
    const us = US_LAYOUT_KEY_NAMES.get(code);
    if (us) {
      return us;
    }
    const match = /^(?:Key|Digit)(.)$/.exec(code) || /^Numpad(\d)$/.exec(code);
    if (match) {
      return (code.startsWith('Numpad') ? 'Num ' : '') + match[1];
    }
    return code;
  }

  /**
   * Reads the player's keyboard layout for `keyName`, anew on every call (so a menu calling it
   * when it opens picks up a layout switched meanwhile). Resolves `true` when the browser told the
   * layout, `false` when it can't (no `navigator.keyboard`, as in Firefox and Safari, or a page
   * embedded without the permission), never rejects.
   */
  public static async loadKeyboardLayout(): Promise<boolean> {
    keyboardLayoutRequested = true;
    const keyboard = typeof navigator === 'undefined' ? undefined : (navigator as any).keyboard;
    try {
      if (!keyboard?.getLayoutMap) {
        keyboardLayoutMap = null;
        return false;
      }
      keyboardLayoutMap = await keyboard.getLayoutMap();
      return true;
    } catch {
      keyboardLayoutMap = null;
      return false;
    }
  }

  /**
   * Whether a key is fit to bind a game action to, for a controls menu capturing the player's
   * choice: `false` for keys the browser or the OS keeps for itself or reports unreliably - Tab,
   * Escape, the function keys, Ctrl/Alt/Meta (they make shortcuts of the other held keys: Ctrl+W
   * closes the tab), lock keys, media, power and IME keys.
   * @param code A `KeyboardEvent.code` value
   */
  public static isBindable(code: string): boolean {
    return !UNBINDABLE_KEY_CODES.test(code);
  }

  /**
   * Creates a new instance of the `KeyboardInput` class.
   */
  constructor() {
    super();
    this.handleKeys = this.handleKeys.bind(this);
    this.resetAllKeys = this.resetAllKeys.bind(this);
    this.onPointerLockChange = this.onPointerLockChange.bind(this);
  }

  protected startInternal() {
    window.addEventListener('keydown', this.handleKeys);
    window.addEventListener('keyup', this.handleKeys);
    window.addEventListener('blur', this.resetAllKeys);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  protected stopInternal() {
    window.removeEventListener('keydown', this.handleKeys);
    window.removeEventListener('keyup', this.handleKeys);
    window.removeEventListener('blur', this.resetAllKeys);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.resetAllKeys();
  }

  /**
   * Creates an observable that emits a boolean whenever a key with the given code is pressed or released
   * @param code The key code to bind the observable to
   * @returns An observable that emits true when the key is pressed and false when it's released
   */
  bind(code: string): Observable<boolean> {
    if (!this.bindings[code]) {
      this.bindings[code] = [];
    }
    const subj = new BehaviorSubject<boolean>(false);
    this.bindings[code].push(subj);
    return subj.pipe(
      distinctUntilChanged(),
      finalize(() => {
        this.bindings[code].splice(this.bindings[code].indexOf(subj), 1);
        subj.complete();
      }),
    );
  }

  /**
   * Creates an observable that emits a boolean indicating whether any of the keys with the given codes are pressed or released.
   * Should be used when you have more than one keys, responsible for the same action.
   * @param codes The key codes to bind the observable to
   * @returns An observable that emits true when any of the keys are pressed and false when they're all released
   */
  bindMany(...codes: string[]): Observable<boolean> {
    if (codes.length == 0) {
      console.warn('[KeyboardController] bindMany called without any key code');
      return NEVER;
    }
    if (codes.length == 1) {
      return this.bind(codes[0]);
    }
    const subjects: BehaviorSubject<boolean>[] = [];
    for (const code of codes) {
      if (!this.bindings[code]) {
        this.bindings[code] = [];
      }
      const subj = new BehaviorSubject<boolean>(false);
      this.bindings[code].push(subj);
      subjects.push(subj);
    }
    return combineLatest(subjects).pipe(
      finalize(() => {
        for (let i = 0; i < codes.length; i++) {
          this.bindings[codes[i]].splice(this.bindings[codes[i]].indexOf(subjects[i]), 1);
          subjects[i].complete();
        }
      }),
      map(values => values.includes(true)),
      distinctUntilChanged(),
    );
  }

  /**
   * Emulates a key down event for the given key code. The key stays down until `emulateKeyUp` (or
   * `resetAllKeys`): a real keyup of the same key meanwhile does not release it, so an on-screen
   * button or a gamepad button holding a key is not let go of by a tap on the keyboard. The reverse
   * holds too: a key held on the physical keyboard stays down across an `emulateKeyUp` of it, until
   * its real keyup. A key is released when the last of its holders lets go.
   *
   * `holder` identifies who holds the key, so that two sources holding the same code (a touch
   * button and a gamepad button both bound to `Space`) do not let go of each other's hold: the key
   * goes up when every holder has called `emulateKeyUp` with its own token. Repeated
   * `emulateKeyDown` calls by one holder count as one hold. Calls without a `holder` all count as
   * one and the same holder.
   * @param code The key code to emulate
   * @param holder An object identifying the holder of the key, the same one to pass to `emulateKeyUp`
   */
  emulateKeyDown(code: string, holder: unknown = this.defaultHolder): void {
    if (!this.running) {
      return;
    }
    let holders = this.emulatedHeld.get(code);
    if (!holders) {
      holders = new Set<unknown>();
      this.emulatedHeld.set(code, holders);
    }
    holders.add(holder);
    for (const subj of this.bindings[code] || []) {
      subj.next(true);
    }
  }

  /**
   * Emulates a key up event for the given key code: `holder` lets go of it, and the key goes up
   * unless another holder (or a finger on the physical key) still holds it
   * @param code The key code to emulate
   * @param holder The object `emulateKeyDown` was called with
   */
  emulateKeyUp(code: string, holder: unknown = this.defaultHolder): void {
    if (!this.running) {
      return;
    }
    const holders = this.emulatedHeld.get(code);
    if (holders) {
      holders.delete(holder);
      if (holders.size > 0) {
        // another emulated holder still holds it
        return;
      }
      this.emulatedHeld.delete(code);
    }
    // a finger on the physical key still holds it
    if (this.physicalHeld.has(code)) {
      return;
    }
    for (const subj of this.bindings[code] || []) {
      subj.next(false);
    }
  }

  /**
   * Whether `holder` holds `code` down through `emulateKeyDown` right now. `false` again after its
   * `emulateKeyUp`, after `resetAllKeys` and after the input stopped (which lets go of every key):
   * how a holder tells that the key it pressed was let go of by something else.
   * @param code The key code
   * @param holder The object `emulateKeyDown` was called with
   */
  isHeldBy(code: string, holder: unknown = this.defaultHolder): boolean {
    return !!this.emulatedHeld.get(code)?.has(holder);
  }

  /**
   * Emulates a key press event (down and up) for the given key code
   * @param code The key code to emulate
   */
  emulateKeyPress(code: string): void {
    this.emulateKeyDown(code);
    this.emulateKeyUp(code);
  }

  private handleKeys(e: KeyboardEvent) {
    if (e.type != 'keydown' && e.type != 'keyup') {
      return;
    }
    const pressed = e.type == 'keydown';
    if (pressed && this.skipKeyDownsOnExternalFocus && document.activeElement) {
      for (const k of KeyboardInput.externalFocusBlacklist) {
        if (document.activeElement instanceof k) {
          return;
        }
      }
    }
    // the auto-repeat of a held key keeps it held; a keyup of a key pressed before this input
    // started (or while it skipped key downs) was never held here, and deletes nothing
    if (pressed && !e.repeat) {
      this.physicalHeld.add(e.code);
    } else if (!pressed) {
      this.physicalHeld.delete(e.code);
    }
    const subs = this.bindings[e.code];
    if (!subs || subs.length === 0) {
      return;
    }
    // Suppress the browser's own default action for a bound key (e.g. Space scrolling the page or
    // activating a focused button, or arrow keys scrolling) - but never when a modifier that
    // signals a browser/OS-level shortcut is held (Alt+ArrowLeft/Right is back/forward navigation,
    // Ctrl/Meta combos are things like closing a tab or switching windows), and never for Tab,
    // since that's the browser's own focus-movement key and swallowing it would break keyboard
    // accessibility even if an app binds it for gameplay. Without these exclusions, any app that
    // binds e.g. ArrowLeft for movement would also block Alt+ArrowLeft back-navigation for the
    // whole page whenever that key happens to be held down.
    if (e.code !== 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
    }
    // Auto-repeat of a held key is not a new press. Taking it for one would press the key again in
    // an input that was restarted (or reset) while the key was down.
    if (pressed && e.repeat) {
      return;
    }
    // A key held through `emulateKeyDown` is still held after the physical key is released
    if (!pressed && this.emulatedHeld.has(e.code)) {
      return;
    }
    for (const subj of subs) {
      subj.next(pressed);
    }
  }

  private onPointerLockChange() {
    // In chrome, if we press key, then exit pointer lock with Escape key, and then release key, the event will not be fired and key will "stuck" in down state
    if (!document.pointerLockElement) {
      this.resetAllKeys();
    }
  }

  public resetAllKeys() {
    this.emulatedHeld.clear();
    this.physicalHeld.clear();
    for (const code in this.bindings) {
      for (const subj of this.bindings[code] || []) {
        subj.next(false);
      }
    }
  }
}
