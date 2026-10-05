import { AssetCache, isAbortError } from '../../../src';

const abortError = () => {
  const e = new Error('aborted');
  e.name = 'AbortError';
  return e;
};

describe('AssetCache', () => {
  it('loads an asset once for concurrent and repeated requests', async () => {
    const cache = new AssetCache();
    const load = jest.fn(async () => ({ value: { id: 1 } }));
    const [a, b] = await Promise.all([cache.acquire('k', undefined, load), cache.acquire('k', undefined, load)]);
    const c = await cache.acquire('k', undefined, load);
    expect(a).toBe(b);
    expect(a).toBe(c);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('tells a request served from an existing entry apart from the one that loaded it', async () => {
    const cache = new AssetCache();
    const load = async () => ({ value: 1 });
    const first = jest.fn();
    const second = jest.fn();
    await cache.acquire('k', undefined, load, undefined, first);
    await cache.acquire('k', undefined, load, undefined, second);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('frees an asset when the last scope holding it is released', async () => {
    const cache = new AssetCache();
    const dispose = jest.fn();
    const load = async () => ({ value: 1, dispose });
    const a = cache.createScope();
    const b = cache.createScope();
    await cache.acquire('k', a, load);
    await cache.acquire('k', b, load);

    a.release();
    expect(dispose).not.toHaveBeenCalled();
    expect(cache.has('k')).toBe(true);

    b.release();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(cache.has('k')).toBe(false);
  });

  it('holds an asset loaded without a scope until the cache is disposed', async () => {
    const cache = new AssetCache();
    const dispose = jest.fn();
    const scope = cache.createScope();
    await cache.acquire('k', undefined, async () => ({ value: 1, dispose }));
    await cache.acquire('k', scope, async () => ({ value: 1, dispose }));
    scope.release();
    expect(dispose).not.toHaveBeenCalled();
    cache.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(0);
  });

  it('frees an asset whose scope was released while it was still loading', async () => {
    const cache = new AssetCache();
    const dispose = jest.fn();
    let finish: (v: { value: number; dispose: () => void }) => void = () => {};
    const scope = cache.createScope();
    const promise = cache.acquire<number>('k', scope, () => new Promise(resolve => (finish = resolve)));
    scope.release();
    finish({ value: 1, dispose });
    await promise;
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(cache.has('k')).toBe(false);
  });

  it('refuses a released scope', async () => {
    const cache = new AssetCache();
    const scope = cache.createScope();
    scope.release();
    await expect(cache.acquire('k', scope, async () => ({ value: 1 }))).rejects.toThrow('already released');
  });

  it('does not cache a failed load', async () => {
    const cache = new AssetCache();
    await expect(cache.acquire('k', undefined, () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(cache.has('k')).toBe(false);
    expect(await cache.acquire('k', undefined, async () => ({ value: 2 }))).toBe(2);
  });

  it('restarts a load aborted by the request that started it for another request still waiting', async () => {
    const cache = new AssetCache();
    const first = new AbortController();
    let rejectFirst: (e: Error) => void = () => {};
    const a = cache
      .acquire<string>('k', undefined, () => new Promise((_, reject) => (rejectFirst = reject)), first.signal)
      .catch(e => e);
    const secondLoad = jest.fn(async () => ({ value: 'second' }));
    const b = cache.acquire('k', undefined, secondLoad);

    first.abort();
    rejectFirst(abortError());

    expect(isAbortError(await a)).toBe(true);
    expect(await b).toBe('second');
    expect(secondLoad).toHaveBeenCalledTimes(1);
  });
});
