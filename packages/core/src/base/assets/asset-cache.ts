import { isAbortError, throwIfAborted } from './load-progress';

type Entry = {
  promise: Promise<unknown>;
  holders: Set<AssetScope>;
  settled: boolean;
  dispose?: () => void;
};

/**
 * A holder of cached assets. Every load made with a scope keeps what it loaded alive for as long as
 * the scope is; `release()` lets go of all of it, and whatever no other scope holds is freed.
 * Created with `world.loader.createAssetScope()`.
 */
export class AssetScope {
  private _released = false;
  /** @internal */
  readonly keys: Set<string> = new Set<string>();

  /** @internal */
  constructor(private readonly cache: AssetCache) {}

  public get released(): boolean {
    return this._released;
  }

  /** Lets go of everything loaded with this scope. The scope can't be used afterwards. */
  public release(): void {
    if (this._released) {
      return;
    }
    this._released = true;
    for (const key of [...this.keys]) {
      this.cache.drop(key, this);
    }
  }
}

/**
 * The per-world asset cache behind `world.loader`: one entry per asset, shared by concurrent and
 * repeated loads, held by scopes and freed when the last scope holding it is released.
 */
export class AssetCache {
  private readonly entries: Map<string, Entry> = new Map<string, Entry>();
  /** Holds every asset loaded without a scope of its own, until the cache is disposed. */
  public readonly root: AssetScope = new AssetScope(this);

  public get size(): number {
    return this.entries.size;
  }

  public has(key: string): boolean {
    return this.entries.has(key);
  }

  public createScope(): AssetScope {
    return new AssetScope(this);
  }

  /**
   * Returns the asset cached under `key` for `scope` to hold, loading it with `load` when it is not
   * there. A load that is aborted by the caller that started it is started again for the others
   * still waiting for it.
   * @param load - Produces the asset and, optionally, how to free it
   * @param onShared - Called when an entry that already existed is used instead of running `load`
   */
  public async acquire<T>(
    key: string,
    scope: AssetScope | undefined,
    load: () => Promise<{ value: T; dispose?: () => void }>,
    signal?: AbortSignal,
    onShared?: () => void,
  ): Promise<T> {
    const holder = scope ?? this.root;
    if (holder.released) {
      throw new Error('Cannot load with an asset scope that was already released');
    }
    while (true) {
      throwIfAborted(signal);
      let entry = this.entries.get(key);
      const shared = !!entry;
      if (!entry) {
        const created: Entry = { promise: null as any, holders: new Set<AssetScope>(), settled: false };
        created.promise = load().then(
          result => {
            created.settled = true;
            created.dispose = result.dispose;
            if (created.holders.size === 0) {
              // everyone let go while it was loading
              this.remove(key, created);
            }
            return result.value;
          },
          error => {
            created.settled = true;
            for (const h of created.holders) {
              h.keys.delete(key);
            }
            created.holders.clear();
            if (this.entries.get(key) === created) {
              this.entries.delete(key);
            }
            throw error;
          },
        );
        this.entries.set(key, created);
        entry = created;
      }
      entry.holders.add(holder);
      holder.keys.add(key);
      try {
        const value = (await entry.promise) as T;
        if (shared) {
          onShared?.();
        }
        return value;
      } catch (e) {
        if (shared && isAbortError(e) && !signal?.aborted) {
          continue;
        }
        throw e;
      }
    }
  }

  /** @internal */
  public drop(key: string, scope: AssetScope): void {
    scope.keys.delete(key);
    const entry = this.entries.get(key);
    if (!entry || !entry.holders.delete(scope)) {
      return;
    }
    if (entry.holders.size === 0 && entry.settled) {
      this.remove(key, entry);
    }
  }

  private remove(key: string, entry: Entry): void {
    if (this.entries.get(key) === entry) {
      this.entries.delete(key);
    }
    const dispose = entry.dispose;
    entry.dispose = undefined;
    dispose?.();
  }

  /** Frees every entry. Loads still running free their result as they finish. */
  public dispose(): void {
    for (const [key, entry] of [...this.entries]) {
      for (const holder of entry.holders) {
        holder.keys.delete(key);
      }
      entry.holders.clear();
      if (entry.settled) {
        this.remove(key, entry);
      }
    }
    this.entries.clear();
  }
}
