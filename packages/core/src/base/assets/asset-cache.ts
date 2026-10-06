import { abortable, abortError, isAbortError, linkSignals, throwIfAborted } from './load-progress';

type Entry = {
  promise: Promise<unknown>;
  holders: Set<AssetScope>;
  /** Calls of `acquire` currently waiting for the load. */
  waiters: number;
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

  /**
   * Holds everything `other` holds, independently of it: what `other` loaded stays cached until
   * both have let go. For something made from another scope's assets that outlives it.
   */
  public adopt(other: AssetScope): void {
    if (this._released) {
      throw new Error('Cannot hold assets with an asset scope that was already released');
    }
    for (const key of other.keys) {
      this.cache.hold(key, this);
    }
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
  private readonly lifetime = new AbortController();

  /** Aborted by `dispose()`: every load still running for this cache is cancelled with it. */
  public get lifetimeSignal(): AbortSignal {
    return this.lifetime.signal;
  }

  public get disposed(): boolean {
    return this.lifetime.signal.aborted;
  }

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
   * still waiting for it. A caller rejects as soon as its own `signal` aborts, without waiting for
   * the load to stop. Rejects with an `AbortError` once the cache is disposed.
   * @param load - Produces the asset and, optionally, how to free it. Its signal aborts with the
   * caller's `signal` or when the cache is disposed - the one to pass to fetches.
   * @param onShared - Called when an entry that already existed is used instead of running `load`
   */
  public async acquire<T>(
    key: string,
    scope: AssetScope | undefined,
    load: (signal: AbortSignal) => Promise<{ value: T; dispose?: () => void }>,
    signal?: AbortSignal,
    onShared?: () => void,
  ): Promise<T> {
    const holder = scope ?? this.root;
    if (holder.released) {
      throw new Error('Cannot load with an asset scope that was already released');
    }
    while (true) {
      throwIfAborted(signal);
      if (this.disposed) {
        throw abortError();
      }
      let entry = this.entries.get(key);
      const shared = !!entry;
      if (!entry) {
        const created: Entry = {
          promise: null as any,
          holders: new Set<AssetScope>(),
          waiters: 0,
          settled: false,
        };
        const loadSignal = linkSignals(signal, this.lifetime.signal);
        let loading: Promise<{ value: T; dispose?: () => void }>;
        try {
          loading = load(loadSignal.signal);
        } catch (e) {
          loading = Promise.reject(e);
        }
        created.promise = loading.finally(loadSignal.release).then(
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
            this.abandon(key, created);
            throw error;
          },
        );
        // every waiter may have given up on it: its rejection is theirs, not unhandled
        created.promise.catch(() => {});
        this.entries.set(key, created);
        entry = created;
      }
      entry.holders.add(holder);
      holder.keys.add(key);
      entry.waiters++;
      try {
        // also when the load itself doesn't stop on its signal (a decode, an adapter's own loader)
        const value = (await abortable(entry.promise, signal, this.lifetime.signal)) as T;
        if (shared) {
          onShared?.();
        }
        return value;
      } catch (e) {
        if (shared && isAbortError(e) && !signal?.aborted && !this.disposed) {
          continue;
        }
        if (entry.waiters === 1 && !entry.settled) {
          // nobody waits for the load any more: it is not cached, and frees its result if it ends
          this.abandon(key, entry);
        }
        throw e;
      } finally {
        entry.waiters--;
      }
    }
  }

  /** @internal */
  public hold(key: string, scope: AssetScope): void {
    const entry = this.entries.get(key);
    if (entry) {
      entry.holders.add(scope);
      scope.keys.add(key);
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

  private abandon(key: string, entry: Entry): void {
    for (const h of entry.holders) {
      h.keys.delete(key);
    }
    entry.holders.clear();
    if (this.entries.get(key) === entry) {
      this.entries.delete(key);
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

  /**
   * Frees every entry and cancels the loads still running (a load that can't be cancelled frees
   * its result when it finishes). The cache takes no new loads afterwards.
   */
  public dispose(): void {
    this.lifetime.abort();
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
