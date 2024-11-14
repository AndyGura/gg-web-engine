import { filter, map, Observable, OperatorFunction, scan, switchMap } from 'rxjs';

export function ggElastic<T>(
  tick$: Observable<[number, number]>, // [elapsed, delta]
  elasticity: number, // Elasticity parameter
  mix: (a: T, b: T, factor: number) => T, // Mixing function
  equals: (a: T, b: T) => boolean, // Equality check function
): OperatorFunction<T, T> {
  return (source$: Observable<T>): Observable<T> => {
    return source$.pipe(
      // Track the target value
      scan(
        (acc, newValue) => ({
          targetValue: newValue,
          currentValue: acc.currentValue ?? newValue, // Initialize to the first value on startup
          hasReachedTarget: false, // Reset reach status on new target
        }),
        { targetValue: null as T | null, currentValue: null as T | null, hasReachedTarget: false },
      ),
      // Switch to using tick$ for timing, emitting interpolated values with each tick
      switchMap(state =>
        tick$.pipe(
          map(([_, delta]) => {
            if (state.targetValue === null || state.currentValue === null) {
              return state.currentValue as T; // If we have no values, output nothing
            }

            // Skip processing if we’ve reached the target and stop emitting
            if (state.hasReachedTarget) {
              return undefined as unknown as T; // Stop emitting by returning `undefined`
            }

            // Adjust factor based on elasticity and delta time
            const factor = 1 - Math.exp(-delta / elasticity);

            // Blend halfway towards the target on each tick
            const newInterpolatedValue = mix(state.currentValue, state.targetValue, factor);

            // Update the currentValue to the new interpolated position
            state.currentValue = newInterpolatedValue;

            // Check if the interpolated value is "close enough" to the target
            if (equals(newInterpolatedValue, state.targetValue)) {
              state.hasReachedTarget = true; // Mark as reached
              return state.targetValue; // Emit exact target value
            }

            return newInterpolatedValue as any;
          }),
        ),
      ),
      // Filter out `undefined` emissions (to stop emitting when settled)
      map(value => (value !== undefined ? value : null)),
      // Remove `null` values (after stopping)
      filter(value => value !== null),
    );
  };
}
