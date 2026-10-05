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
 */
export class LoadProgressGroup {
  private readonly slots: LoadProgress[] = [];
  private fraction = 0;
  private current: string | null = null;
  private finished = false;

  constructor(private readonly options: LoadTaskOptions) {}

  /** Options for one nested load: its progress goes into this group, signal and scope carry over. */
  public sub(): LoadTaskOptions {
    const result: LoadTaskOptions = { signal: this.options.signal, scope: this.options.scope };
    if (this.options.onProgress) {
      const index = this.slots.push(EMPTY) - 1;
      result.onProgress = progress => {
        this.slots[index] = progress;
        this.current = progress.current ?? this.current;
        this.emit();
      };
    }
    return result;
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
    let loadedItems = 0;
    let totalItems = 0;
    let bytesLoaded = 0;
    let bytesTotal: number | null = 0;
    for (const slot of this.slots) {
      weighted += slot.fraction * slot.totalItems;
      loadedItems += slot.loadedItems;
      totalItems += slot.totalItems;
      bytesLoaded += slot.bytesLoaded;
      bytesTotal = bytesTotal === null || slot.bytesTotal === null ? null : bytesTotal + slot.bytesTotal;
    }
    const fraction = this.finished ? 1 : totalItems ? Math.min(weighted / totalItems, 0.999) : 0;
    // an asset discovered late lowers the mean; what was already shown is never taken back
    this.fraction = Math.max(this.fraction, fraction);
    this.options.onProgress({
      fraction: this.fraction,
      loadedItems,
      totalItems,
      bytesLoaded,
      bytesTotal,
      current: this.current,
    });
  }
}
