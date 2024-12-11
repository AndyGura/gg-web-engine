import { IInput } from './i-input';
import { BehaviorSubject, combineLatest, finalize, NEVER, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

/**
 * A main keyboard input: it does not have own key bindings, but provides an API to bind keys.
 * It is responsible for listening key up/down events (when running!) and emit the events to subscribers.
 * Every World entity has its own dedicated instance of Keyboard input, which is running only when the world is running
 */
export class KeyboardInput extends IInput {
  private bindings: { [code: string]: BehaviorSubject<boolean>[] } = {};

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
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
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
   * Emulates a key down event for the given key code
   * @param code The key code to emulate
   */
  emulateKeyDown(code: string): void {
    if (!this.running) {
      return;
    }
    for (const subj of this.bindings[code] || []) {
      subj.next(true);
    }
  }

  /**
   * Emulates a key up event for the given key code
   * @param code The key code to emulate
   */
  emulateKeyUp(code: string): void {
    if (!this.running) {
      return;
    }
    for (const subj of this.bindings[code] || []) {
      subj.next(false);
    }
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
    for (const subj of this.bindings[e.code] || []) {
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
    for (const code in this.bindings) {
      for (const subj of this.bindings[code] || []) {
        subj.next(false);
      }
    }
  }
}
