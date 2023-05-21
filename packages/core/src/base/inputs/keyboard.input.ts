import { Input } from './input';
import { BehaviorSubject, combineLatest, finalize, NEVER, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * A main keyboard input: it does not have own key bindings, but provides an API to bind keys.
 * It is responsible for listening key up/down events (when running!) and emit the events to subscribers.
 * Every World entity has its own dedicated instance of Keyboard input, which is running only when the world is running
 */
export class KeyboardInput extends Input {
  private bindings: { [code: string]: BehaviorSubject<boolean>[] } = {};

  /**
   * Creates a new instance of the `KeyboardInput` class.
   */
  constructor() {
    super();
    this.handleKeys = this.handleKeys.bind(this);
  }

  protected startInternal() {
    window.addEventListener('keydown', this.handleKeys);
    window.addEventListener('keyup', this.handleKeys);
  }

  protected stopInternal() {
    window.removeEventListener('keydown', this.handleKeys);
    window.removeEventListener('keyup', this.handleKeys);
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
    for (const subj of this.bindings[e.code] || []) {
      subj.next(pressed);
    }
  }
}
