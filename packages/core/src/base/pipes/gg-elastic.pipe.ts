import { map, Observable, OperatorFunction, scan, switchMap } from 'rxjs';

export default function ggElastic<T>(
  tick$: Observable<[number, number]>,  // [elapsed, delta]
  elasticity: number,                   // Elasticity parameter
  mix: (a: T, b: T, factor: number) => T, // Mixing function
): OperatorFunction<T, T> {
  return (source$: Observable<T>): Observable<T> => {
    return source$.pipe(
      // When a new value arrives, set it as the target and reset the progress
      scan(
        (acc, newValue) => ({
          lastValue: acc.currentValue ?? newValue,
          currentValue: newValue,
          progress: 0,
        }),
        { lastValue: null as T | null, currentValue: null as T | null, progress: 0 },
      ),
      // Switch to using tick$ for timing, emitting interpolated values with each tick
      switchMap((state) =>
        tick$.pipe(
          // Update progress on each tick
          scan(
            (acc, [_, delta]) => {
              // Increase progress based on delta and elasticity
              const newProgress = Math.min(acc.progress + delta / elasticity, 1);

              // Calculate interpolated value between lastValue and currentValue
              const interpolatedValue = mix(acc.lastValue as T, state.currentValue as T, newProgress);

              // If progress reaches 1, we set lastValue to currentValue for stability
              const isTransitionComplete = newProgress >= 1;

              return {
                lastValue: isTransitionComplete ? state.currentValue : acc.lastValue,
                currentValue: state.currentValue,
                progress: isTransitionComplete ? 1 : newProgress,
                outputValue: isTransitionComplete ? state.currentValue : interpolatedValue,
              };
            },
            { lastValue: state.lastValue, currentValue: state.currentValue, progress: 0, outputValue: state.lastValue },
          ),
          // Output only the interpolated value
          map(({ outputValue }) => outputValue),
        ),
      ),
    ) as any;
  };
}
