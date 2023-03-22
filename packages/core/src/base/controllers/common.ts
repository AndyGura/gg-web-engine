import { combineLatest, Observable } from 'rxjs';
import { KeyboardController } from './keyboard.controller';
import { map } from 'rxjs/operators';

export type DirectionKeymap = 'arrows' | 'wasd' | 'wasd+arrows';

export type DirectionOutput = { upDown?: boolean; leftRight?: boolean };

export const bindDirectionKeys: (
  keyboard: KeyboardController,
  keymap: DirectionKeymap,
) => Observable<DirectionOutput> = (keyboard: KeyboardController, keymap: DirectionKeymap) => {
  const keys = [[], [], [], []] as string[][];
  if (keymap.includes('wasd')) {
    keys[0].push('KeyW');
    keys[1].push('KeyA');
    keys[2].push('KeyS');
    keys[3].push('KeyD');
  }
  if (keymap.includes('arrows')) {
    keys[0].push('ArrowUp');
    keys[1].push('ArrowLeft');
    keys[2].push('ArrowDown');
    keys[3].push('ArrowRight');
  }
  return combineLatest(keys.map(x => keyboard.bindMany(...x))).pipe(
    map(moveDirection => {
      const result: DirectionOutput = {};
      if (moveDirection.includes(true)) {
        const [f, l, b, r] = moveDirection;
        if (f != b) result.upDown = f;
        if (l != r) result.leftRight = l;
      }
      return result;
    }),
  );
};
