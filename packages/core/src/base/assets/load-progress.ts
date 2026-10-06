import { AssetScope } from './asset-cache';

/**
 * How far a load has come. Reported by every loader that takes {@link LoadTaskOptions}: for a
 * single asset it describes that asset, for a level (or `preload`) everything it references.
 */
export type LoadProgress = {
  /** 0..1. Never decreases within one load, also when more assets turn up along the way. */
  fraction: number;
  /** Assets fully fetched and decoded. */
  loadedItems: number;
  /** Assets known so far. Grows when an asset references further ones (a model's props). */
  totalItems: number;
  bytesLoaded: number;
  /** `null` while the size of any asset being fetched is unknown (no `Content-Length`). */
  bytesTotal: number | null;
  /** URL of the asset worked on most recently. */
  current: string | null;
};

/** Options every loader of `world.loader` takes on top of its own. */
export type LoadTaskOptions = {
  /** Called on every progress change, and once with `fraction: 1` when the load is complete. */
  onProgress?: (progress: LoadProgress) => void;
  /** Cancels the load: the returned promise rejects with an `AbortError`. */
  signal?: AbortSignal;
  /**
   * Who holds the loaded assets in the loader's cache (see `AssetScope`). Without one they are held
   * until the world is disposed.
   */
  scope?: AssetScope;
};

/** Share of one asset's progress taken by decoding it (parsing, GPU upload) after the fetch. */
export const DECODE_PROGRESS_SHARE = 0.3;

const EMPTY: LoadProgress = {
  fraction: 0,
  loadedItems: 0,
  totalItems: 0,
  bytesLoaded: 0,
  bytesTotal: 0,
  current: null,
};

/** Whether `error` is what an aborted load rejects with. */
export function isAbortError(error: unknown): boolean {
  return !!error && (error as any).name === 'AbortError';
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw abortError();
  }
}

/**
 * A signal aborted as soon as any of `signals` is. `release()` detaches it from them once the work
 * it was made for is over, so a long-lived source signal doesn't keep a listener per load.
 */
export function linkSignals(...signals: (AbortSignal | undefined)[]): { signal: AbortSignal; release: () => void } {
  const controller = new AbortController();
  const sources = signals.filter((s): s is AbortSignal => !!s);
  const abort = () => controller.abort();
  if (sources.some(s => s.aborted)) {
    controller.abort();
    return { signal: controller.signal, release: () => {} };
  }
  for (const source of sources) {
    source.addEventListener('abort', abort);
  }
  return {
    signal: controller.signal,
    release: () => sources.forEach(source => source.removeEventListener('abort', abort)),
  };
}

/** Settles like `promise`, or rejects with an `AbortError` as soon as one of `signals` aborts. */
export function abortable<T>(promise: Promise<T>, ...signals: (AbortSignal | undefined)[]): Promise<T> {
  const sources = signals.filter((s): s is AbortSignal => !!s);
  if (!sources.length) {
    return promise;
  }
  return new Promise<T>((resolve, reject) => {
    const linked = linkSignals(...sources);
    const onAbort = () => {
      linked.release();
      reject(abortError());
    };
    if (linked.signal.aborted) {
      onAbort();
      return;
    }
    linked.signal.addEventListener('abort', onAbort);
    promise.then(
      value => {
        linked.release();
        resolve(value);
      },
      error => {
        linked.release();
        reject(error);
      },
    );
  });
}

export function abortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The load was aborted', 'AbortError');
  }
  const error = new Error('The load was aborted');
  error.name = 'AbortError';
  return error;
}

/**
 * Progress of one asset: any number of fetched files, then one decode step.
 */
export class AssetProgress {
  private readonly files: { loaded: number; total: number | null; done: boolean }[] = [];
  private decoded = false;

  constructor(
    private readonly url: string,
    private readonly onProgress: ((progress: LoadProgress) => void) | undefined,
  ) {
    this.emit();
  }

  /** Registers one file of the asset; the returned function reports its fetched bytes. */
  public file(): (loaded: number, total: number | null, done: boolean) => void {
    const file = { loaded: 0, total: null as number | null, done: false };
    this.files.push(file);
    return (loaded, total, done) => {
      file.loaded = loaded;
      file.total = total;
      file.done = done;
      this.emit();
    };
  }

  /** Marks the asset fetched and decoded. */
  public done(): void {
    this.decoded = true;
    for (const file of this.files) {
      file.done = true;
    }
    this.emit();
  }

  private emit(): void {
    if (!this.onProgress) {
      return;
    }
    let fetched = 0;
    let bytesLoaded = 0;
    let bytesTotal: number | null = 0;
    for (const file of this.files) {
      bytesLoaded += file.loaded;
      if (file.done) {
        fetched += 1;
        bytesTotal = bytesTotal === null ? null : bytesTotal + file.loaded;
      } else if (file.total) {
        fetched += Math.min(1, file.loaded / file.total);
        bytesTotal = bytesTotal === null ? null : bytesTotal + file.total;
      } else {
        bytesTotal = null;
      }
    }
    const fetchFraction = this.files.length ? fetched / this.files.length : 0;
    this.onProgress({
      fraction: this.decoded ? 1 : fetchFraction * (1 - DECODE_PROGRESS_SHARE),
      loadedItems: this.decoded ? 1 : 0,
      totalItems: 1,
      bytesLoaded,
      bytesTotal,
      current: this.url,
    });
  }
}

/**
 * Combines the progress of several loads into one. Each `sub()` is a slot to hand to one nested
 * loader call as its options; the combined fraction is the mean over every asset the slots report.
 *
 * A slot that has not reported any asset yet, and is not complete, holds the weight of one asset:
 * create the slots of every step known up front (also the ones that only start after an earlier
 * step finished), so a first step that completes early does not read as the whole load being done.
 * When assets turn up late and lower the mean, the shown fraction stays where it was and from then
 * on covers the rest of the bar in proportion to the work that remains, so it never goes down and
 * never stalls.
 */
export class LoadProgressGroup {
  private readonly slots: { progress: LoadProgress; complete: boolean }[] = [];
  private readonly slotIndex = new Map<LoadTaskOptions, number>();
  /** The fraction reported. */
  private shown = 0;
  /** The plain weighted mean `shown` was last brought in line with. */
  private anchor = 0;
  private current: string | null = null;
  private finished = false;

  constructor(private readonly options: LoadTaskOptions) {}

  /** Options for one nested load: its progress goes into this group, signal and scope carry over. */
  public sub(): LoadTaskOptions {
    const result: LoadTaskOptions = { signal: this.options.signal, scope: this.options.scope };
    if (this.options.onProgress) {
      const slot = { progress: EMPTY, complete: false };
      this.slotIndex.set(result, this.slots.push(slot) - 1);
      result.onProgress = progress => {
        slot.progress = progress;
        slot.complete = slot.complete || progress.fraction >= 1;
        this.current = progress.current ?? this.current;
        this.emit();
      };
    }
    return result;
  }

  /**
   * Reports the load a slot was handed to as settled, also when it reported nothing (a step that
   * loads nothing, or loaded only what the cache already held), so its reserved weight is released.
   * @param slot - The options `sub()` returned
   */
  public complete(slot: LoadTaskOptions): void {
    const index = this.slotIndex.get(slot);
    if (index === undefined || this.slots[index].complete) {
      return;
    }
    this.slots[index].complete = true;
    this.emit();
  }

  /** Reports the group complete. Call once everything nested has settled. */
  public finish(): void {
    this.finished = true;
    this.emit();
  }

  private emit(): void {
    if (!this.options.onProgress) {
      return;
    }
    let weighted = 0;
    let weights = 0;
    let loadedItems = 0;
    let totalItems = 0;
    let bytesLoaded = 0;
    let bytesTotal: number | null = 0;
    for (const { progress, complete } of this.slots) {
      const weight = complete ? progress.totalItems : Math.max(progress.totalItems, 1);
      weighted += (complete ? 1 : progress.fraction) * weight;
      weights += weight;
      loadedItems += progress.loadedItems;
      totalItems += progress.totalItems;
      bytesLoaded += progress.bytesLoaded;
      bytesTotal = bytesTotal === null || progress.bytesTotal === null ? null : bytesTotal + progress.bytesTotal;
    }
    const mean = weights ? weighted / weights : 0;
    if (this.finished) {
      this.shown = 1;
    } else if (mean < this.anchor) {
      // assets discovered late: keep what was shown, measure further progress from here
      this.anchor = mean;
    } else if (mean > this.anchor) {
      this.shown = Math.min(this.shown + ((1 - this.shown) * (mean - this.anchor)) / (1 - this.anchor), 0.999);
      this.anchor = mean;
    }
    this.options.onProgress({
      fraction: this.shown,
      loadedItems,
      totalItems,
      bytesLoaded,
      bytesTotal,
      current: this.current,
    });
  }
}
