import { distinctUntilChanged, Observable, of, takeUntil } from 'rxjs';

/**
 * Keeps inputs in step with a world's `inputEnabled`: calls `start` right away if input is enabled
 * and every time it is enabled again, `stop` every time it is disabled, until `until$` emits. An
 * input controller calls this from `onSpawned` (with its `_onRemoved$`) in place of starting its
 * `MouseInput`/`DirectionInput` directly, so it goes quiet whenever the world's input is switched
 * off - while another screen covers the game, say. Stopping the inputs for good when the controller
 * is removed stays the controller's own job.
 */
export function runWhileInputEnabled(
  world: { inputEnabled$?: Observable<boolean> },
  until$: Observable<unknown>,
  start: () => void,
  stop: () => void,
): void {
  (world.inputEnabled$ ?? of(true))
    .pipe(distinctUntilChanged(), takeUntil(until$))
    .subscribe(enabled => (enabled ? start() : stop()));
}
