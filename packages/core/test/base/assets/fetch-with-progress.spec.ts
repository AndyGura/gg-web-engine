import { fetchWithProgress, isAbortError } from '../../../src';
import { mockFetch, restoreFetch } from '../../mocks/fetch.mock';

describe('fetchWithProgress', () => {
  afterEach(() => restoreFetch());

  it('returns the whole file and reports bytes against Content-Length', async () => {
    mockFetch({ 'a.bin': { data: new Uint8Array([1, 2, 3, 4, 5, 6]), chunks: 3 } });
    const calls: [number, number | null, boolean][] = [];
    const result = await fetchWithProgress('a.bin', (loaded, total, done) => calls.push([loaded, total, done]));
    expect([...new Uint8Array(result)]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(calls).toEqual([
      [2, 6, false],
      [4, 6, false],
      [6, 6, false],
      [6, 6, true],
    ]);
  });

  it('reports an unknown total until the download is complete when Content-Length is missing', async () => {
    mockFetch({ 'a.bin': { data: 'abcd', chunks: 2, contentLength: false } });
    const calls: [number, number | null, boolean][] = [];
    await fetchWithProgress('a.bin', (loaded, total, done) => calls.push([loaded, total, done]));
    expect(calls).toEqual([
      [2, null, false],
      [4, null, false],
      [4, 4, true],
    ]);
  });

  it('works without a progress callback', async () => {
    mockFetch({ 'a.txt': 'hello' });
    const result = await fetchWithProgress('a.txt');
    expect(new TextDecoder().decode(result)).toBe('hello');
  });

  it('rejects on a non-2xx response', async () => {
    mockFetch({});
    await expect(fetchWithProgress('missing.bin')).rejects.toThrow('Failed to load "missing.bin": 404 Not Found');
  });

  it('rejects with an AbortError when already aborted, without fetching', async () => {
    const fetch = mockFetch({ 'a.txt': 'hello' });
    const controller = new AbortController();
    controller.abort();
    const error = await fetchWithProgress('a.txt', undefined, controller.signal).catch(e => e);
    expect(isAbortError(error)).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects with an AbortError when aborted mid-download', async () => {
    const fetch = mockFetch({ 'a.txt': { data: 'hello world', chunks: 4 } });
    fetch.hold();
    const controller = new AbortController();
    const onBytes = jest.fn();
    const promise = fetchWithProgress('a.txt', onBytes, controller.signal).catch(e => e);
    await Promise.resolve();
    controller.abort();
    fetch.release();
    expect(isAbortError(await promise)).toBe(true);
    expect(onBytes).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), true);
  });
});
