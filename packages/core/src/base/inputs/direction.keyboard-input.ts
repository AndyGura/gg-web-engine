import { combineLatest, Observable, Subject, takeUntil } from 'rxjs';
import { KeyboardInput } from './keyboard.input';
import { map } from 'rxjs/operators';
import { Input } from './input';

/**
 * The type representing desired keymap for DirectionKeyboardInput
 */
export type DirectionKeyboardKeymap = 'arrows' | 'wasd' | 'wasd+arrows';

/**
 * The type of DirectionKeyboardInput output value
 */
export type DirectionKeyboardOutput = { upDown?: boolean; leftRight?: boolean };

/**
 * An input class, responsible for handling direction keys and providing simple current direction observable.
 * Supports two the most popular keyboard layouts: WASD and arrows.
 */
export class DirectionKeyboardInput extends Input {
  /**
   * A subject that emits `DirectionKeyboardOutput` objects whenever the input changes.
   */
  private _output$: Subject<DirectionKeyboardOutput> = new Subject<DirectionKeyboardOutput>();

  /**
   * Returns an observable that emits `DirectionKeyboardOutput` objects whenever the input changes.
   */
  public get output$(): Observable<DirectionKeyboardOutput> {
    return this._output$.asObservable();
  }

  /**
   * Creates a new instance of the `DirectionKeyboardInput` class.
   *
   * @param keyboard The `KeyboardInput` instance to use for input handling. You should probably use one from the World instance
   * @param keymap The `DirectionKeyboardKeymap` defining which keys to listen for.
   */
  constructor(protected readonly keyboard: KeyboardInput, protected readonly keymap: DirectionKeyboardKeymap) {
    super();
  }

  /**
   * Called when the input handling should start.
   */
  protected async startInternal(): Promise<void> {
    // Initialize an array to hold the keys to listen for
    const keys = [[], [], [], []] as string[][];
    // Add the "wasd" keys to the array if specified in the keymap
    if (this.keymap.includes('wasd')) {
      keys[0].push('KeyW');
      keys[1].push('KeyA');
      keys[2].push('KeyS');
      keys[3].push('KeyD');
    }
    // Add the arrow keys to the array if specified in the keymap
    if (this.keymap.includes('arrows')) {
      keys[0].push('ArrowUp');
      keys[1].push('ArrowLeft');
      keys[2].push('ArrowDown');
      keys[3].push('ArrowRight');
    }
    // Bind to the keyboard events for the specified keys
    combineLatest(keys.map(x => this.keyboard.bindMany(...x)))
      .pipe(
        // Stop listening when the `stop$` signal is received
        takeUntil(this.stop$),
        // Map the key states to a `DirectionKeyboardOutput` object
        map(moveDirection => {
          const result: DirectionKeyboardOutput = {};
          if (moveDirection.includes(true)) {
            const [f, l, b, r] = moveDirection;
            if (f != b) result.upDown = f;
            if (l != r) result.leftRight = l;
          }
          return result;
        }),
      )
      // Emit the resulting `DirectionKeyboardOutput` object through the `_output$` subject
      .subscribe(this._output$);
  }
}
