import { AssetProgress, DECODE_PROGRESS_SHARE, LoadProgress, LoadProgressGroup } from '../../../src';

describe('AssetProgress', () => {
  it('counts decoding as part of the asset: fetched is not finished', () => {
    const calls: LoadProgress[] = [];
    const item = new AssetProgress('a.glb', p => calls.push(p));
    const bytes = item.file();
    bytes(50, 100, false);
    bytes(100, 100, true);
    expect(calls[calls.length - 1].fraction).toBeCloseTo(1 - DECODE_PROGRESS_SHARE);
    expect(calls[calls.length - 1].loadedItems).toBe(0);
    item.done();
    expect(calls[calls.length - 1]).toEqual({
      fraction: 1,
      loadedItems: 1,
      totalItems: 1,
      bytesLoaded: 100,
      bytesTotal: 100,
      current: 'a.glb',
    });
    expect(calls[1].fraction).toBeCloseTo(0.5 * (1 - DECODE_PROGRESS_SHARE));
  });

  it('falls back to counting files when a size is unknown', () => {
    const calls: LoadProgress[] = [];
    const item = new AssetProgress('pair', p => calls.push(p));
    const a = item.file();
    const b = item.file();
    a(10, null, false);
    expect(calls[calls.length - 1].fraction).toBe(0);
    expect(calls[calls.length - 1].bytesTotal).toBeNull();
    a(20, 20, true);
    expect(calls[calls.length - 1].fraction).toBeCloseTo(0.5 * (1 - DECODE_PROGRESS_SHARE));
    b(5, 10, false);
    expect(calls[calls.length - 1].bytesTotal).toBe(30);
  });
});

describe('LoadProgressGroup', () => {
  it('combines nested loads into one progress and passes signal and scope down', () => {
    const calls: LoadProgress[] = [];
    const signal = new AbortController().signal;
    const scope = {} as any;
    const group = new LoadProgressGroup({ onProgress: p => calls.push(p), signal, scope });
    const a = group.sub();
    const b = group.sub();
    expect(a.signal).toBe(signal);
    expect(a.scope).toBe(scope);

    const itemA = new AssetProgress('a', a.onProgress);
    const itemB = new AssetProgress('b', b.onProgress);
    itemA.done();
    const last = () => calls[calls.length - 1];
    expect(last().fraction).toBeCloseTo(0.5);
    expect(last().loadedItems).toBe(1);
    expect(last().totalItems).toBe(2);
    itemB.done();
    expect(last().fraction).toBeLessThan(1);
    group.finish();
    expect(last().fraction).toBe(1);
  });

  it('never reports a lower fraction when more assets turn up', () => {
    const calls: LoadProgress[] = [];
    const group = new LoadProgressGroup({ onProgress: p => calls.push(p) });
    new AssetProgress('a', group.sub().onProgress).done();
    const before = calls[calls.length - 1].fraction;
    new AssetProgress('late', group.sub().onProgress);
    const after = calls[calls.length - 1];
    expect(after.totalItems).toBe(2);
    expect(after.fraction).toBe(before);
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i].fraction).toBeGreaterThanOrEqual(calls[i - 1].fraction);
    }
  });

  it('reserves weight for a step that has not reported yet', () => {
    const calls: LoadProgress[] = [];
    const group = new LoadProgressGroup({ onProgress: p => calls.push(p) });
    const first = group.sub();
    const second = group.sub();
    new AssetProgress('document', first.onProgress).done();
    // the first step alone is done: half the bar, not all of it
    expect(calls[calls.length - 1].fraction).toBeCloseTo(0.5);

    // the second step turns out to hold four assets: the bar holds, then covers the rest
    const nested = new LoadProgressGroup(second);
    const items = [0, 1, 2, 3].map(i => new AssetProgress(`asset${i}`, nested.sub().onProgress));
    expect(calls[calls.length - 1].fraction).toBeCloseTo(0.5);
    items[0].done();
    items[1].done();
    expect(calls[calls.length - 1].fraction).toBeCloseTo(0.75);
    items[2].done();
    items[3].done();
    expect(calls[calls.length - 1].fraction).toBeCloseTo(0.999);
    nested.finish();
    group.finish();
    expect(calls[calls.length - 1].fraction).toBe(1);
    expect(calls[calls.length - 1].totalItems).toBe(5);
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i].fraction).toBeGreaterThanOrEqual(calls[i - 1].fraction);
    }
  });

  it('releases the weight of a step completed without reporting anything', () => {
    const calls: LoadProgress[] = [];
    const group = new LoadProgressGroup({ onProgress: p => calls.push(p) });
    const silent = group.sub();
    const loading = group.sub();
    const item = new AssetProgress('a', loading.onProgress);
    expect(calls[calls.length - 1].fraction).toBe(0);
    group.complete(silent);
    item.done();
    expect(calls[calls.length - 1].fraction).toBeCloseTo(0.999);
    expect(calls[calls.length - 1].totalItems).toBe(1);
  });

  it('does not count a load served from the cache as an item', () => {
    const calls: LoadProgress[] = [];
    const group = new LoadProgressGroup({ onProgress: p => calls.push(p) });
    group.sub().onProgress!({
      fraction: 1,
      loadedItems: 0,
      totalItems: 0,
      bytesLoaded: 0,
      bytesTotal: 0,
      current: 'cached',
    });
    expect(calls[calls.length - 1].totalItems).toBe(0);
  });
});
