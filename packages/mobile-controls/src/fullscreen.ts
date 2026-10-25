import { distinctUntilChanged, fromEvent, map, merge, Observable, of, startWith } from 'rxjs';

/** The standard and WebKit-prefixed members of the Fullscreen API, which TypeScript's DOM types partly lack. */
type FullscreenDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FullscreenElement = Element & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

const hasDocument = () => typeof document !== 'undefined';

function requestMethod(element: Element): (() => Promise<void> | void) | null {
  const el = element as FullscreenElement;
  const method = typeof el.requestFullscreen === 'function' ? el.requestFullscreen : el.webkitRequestFullscreen;
  return typeof method === 'function' ? method.bind(el) : null;
}

/**
 * Whether `element` (the whole page by default) can be shown fullscreen here: the browser has the
 * Fullscreen API (standard or WebKit-prefixed) and the page is allowed to use it. `false` on an
 * iPhone, whose Safari shows only videos fullscreen, and in an iframe without `allowfullscreen`.
 */
export function isFullscreenAvailable(element?: Element): boolean {
  if (!hasDocument()) {
    return false;
  }
  const doc = document as FullscreenDocument;
  const flags = [doc.fullscreenEnabled, doc.webkitFullscreenEnabled].filter(flag => flag !== undefined);
  if (flags.length > 0 && !flags.some(flag => flag)) {
    return false;
  }
  return requestMethod(element ?? document.documentElement) !== null;
}

/** The element shown fullscreen at the moment, or `null` (standard or WebKit-prefixed API alike). */
export function fullscreenElement(): Element | null {
  if (!hasDocument()) {
    return null;
  }
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/** Whether something on the page is shown fullscreen at the moment. */
export function isFullscreen(): boolean {
  return fullscreenElement() !== null;
}

/**
 * Whether the page is fullscreen: the current state on subscription, then every change
 * (`fullscreenchange`, or `webkitfullscreenchange` where only the prefixed API exists).
 * Never emits again where there is no document.
 */
export function fullscreen$(): Observable<boolean> {
  if (!hasDocument()) {
    return of(false);
  }
  return merge(fromEvent(document, 'fullscreenchange'), fromEvent(document, 'webkitfullscreenchange')).pipe(
    startWith(null),
    map(() => isFullscreen()),
    distinctUntilChanged(),
  );
}

/**
 * Leaves fullscreen when something on the page is fullscreen, otherwise shows `element` (the whole
 * page by default) fullscreen. Works with the standard and the WebKit-prefixed API, and never throws
 * or rejects: where fullscreen is not available (`isFullscreenAvailable`) it resolves at once.
 *
 * Entering fullscreen needs a user gesture, so call it from an input event handler (for a touch, the
 * finger lifting: `TouchButton.onTap`). For the end state listen to `fullscreen$` - the prefixed API
 * of an older Safari reports it only through its event.
 *
 * @returns whether the browser accepted the request: `false` when fullscreen is not available or the
 * browser refused it.
 */
export async function toggleFullscreen(element?: Element): Promise<boolean> {
  if (!hasDocument()) {
    return false;
  }
  const doc = document as FullscreenDocument;
  try {
    if (isFullscreen()) {
      const exit = typeof doc.exitFullscreen === 'function' ? doc.exitFullscreen : doc.webkitExitFullscreen;
      if (typeof exit !== 'function') {
        return false;
      }
      await exit.call(doc);
      return true;
    }
    const target = element ?? document.documentElement;
    if (!isFullscreenAvailable(target)) {
      return false;
    }
    // the prefixed method of an older Safari returns nothing instead of a promise
    await requestMethod(target)!();
    return true;
  } catch (e) {
    return false;
  }
}
