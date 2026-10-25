import {
  auditTime,
  defer,
  delay,
  distinctUntilChanged,
  EMPTY,
  fromEvent,
  map,
  merge,
  Observable,
  startWith,
} from 'rxjs';
import { Point2 } from '../../models/points';

/**
 * How long after an `orientationchange` event the page is measured again, in milliseconds. Some
 * browsers (notably iOS, in a page added to the home screen) still report the size from before the
 * rotation when the event fires, and only settle on the new one a moment later.
 */
export const VIEWPORT_REMEASURE_DELAY = 300;

/**
 * Measures the page's visible area in CSS pixels: the size a `'fullscreen'` renderer is given.
 *
 * Read through `window.visualViewport` where the browser has one, since `window.innerWidth`/
 * `innerHeight` can be stale on some mobile browsers (an iOS home-screen app right after a rotation).
 * The visual viewport's size is multiplied by its `scale`, so a pinch zoom doesn't shrink the result;
 * an on-screen keyboard does (the area it covers is not visible). Falls back to `innerWidth`/
 * `innerHeight` without a visual viewport (older browsers, jsdom) or while it reports an empty size.
 */
export function measureViewport(): Point2 {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (vv && vv.width > 0 && vv.height > 0) {
    const scale = vv.scale > 0 ? vv.scale : 1;
    return { x: vv.width * scale, y: vv.height * scale };
  }
  return { x: window.innerWidth, y: window.innerHeight };
}

/**
 * The page's visible area (see {@link measureViewport}) as an observable: emits the current size on
 * subscription, then again after each window or visual viewport `resize` (at most once per 100 ms)
 * and on each `orientationchange` - once right away and once more `remeasureDelay` ms later, for the
 * browsers that report the old size at first. Repeated sizes are skipped. The listeners are added on
 * subscription and removed when the subscription ends. This is what a `'fullscreen'` renderer
 * follows, and app code laying out its own DOM around the game can follow the same measurements.
 *
 * @param remeasureDelay delay of the second measurement after a rotation, in milliseconds
 */
export function viewportSize$(remeasureDelay: number = VIEWPORT_REMEASURE_DELAY): Observable<Point2> {
  return defer(() => {
    const vv = window.visualViewport;
    const orientationChange$ = fromEvent(window, 'orientationchange');
    return merge(
      merge(fromEvent(window, 'resize'), vv ? fromEvent(vv, 'resize') : EMPTY).pipe(auditTime(100)),
      orientationChange$,
      orientationChange$.pipe(delay(remeasureDelay)),
    ).pipe(
      map(() => measureViewport()),
      startWith(measureViewport()),
      distinctUntilChanged((a, b) => a.x === b.x && a.y === b.y),
    );
  });
}
