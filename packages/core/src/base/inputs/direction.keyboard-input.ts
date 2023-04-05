import { combineLatest, Observable, Subject, takeUntil } from 'rxjs';
import { KeyboardInput } from './keyboard.input';
import { map } from 'rxjs/operators';
import { Input } from './input';

export type DirectionKeyboardKeymap = 'arrows' | 'wasd' | 'wasd+arrows';

export type DirectionKeyboardOutput = { upDown?: boolean; leftRight?: boolean };

export class DirectionKeyboardInput extends Input {

  private _output$: Subject<DirectionKeyboardOutput> = new Subject<DirectionKeyboardOutput>();

  public get output$(): Observable<DirectionKeyboardOutput> {
    return this._output$.asObservable();
  }

  constructor(
    protected readonly keyboard: KeyboardInput,
    protected readonly keymap: DirectionKeyboardKeymap
  ) {
    super();
  }
  protected async startInternal(): Promise<void> {
    const keys = [[], [], [], []] as string[][];
    if (this.keymap.includes('wasd')) {
      keys[0].push('KeyW');
      keys[1].push('KeyA');
      keys[2].push('KeyS');
      keys[3].push('KeyD');
    }
    if (this.keymap.includes('arrows')) {
      keys[0].push('ArrowUp');
      keys[1].push('ArrowLeft');
      keys[2].push('ArrowDown');
      keys[3].push('ArrowRight');
    }
    combineLatest(keys.map(x => this.keyboard.bindMany(...x))).pipe(
      takeUntil(this.stop$),
      map(moveDirection => {
        const result: DirectionKeyboardOutput = {};
        if (moveDirection.includes(true)) {
          const [f, l, b, r] = moveDirection;
          if (f != b) result.upDown = f;
          if (l != r) result.leftRight = l;
        }
        return result;
      }),
    );
  }
}
