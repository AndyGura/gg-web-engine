export type MockFile = {
  /** File contents: a string (UTF-8) or raw bytes. */
  data: string | Uint8Array;
  /** How many chunks the body stream delivers the data in. Default 2. */
  chunks?: number;
  /** Whether the response carries `Content-Length`. Default `true`. */
  contentLength?: boolean;
  status?: number;
};

export type MockFetch = jest.Mock & {
  /** Resolves the reads held back by `hold()`. */
  release: () => void;
  /** Makes every body read wait until `release()` - for aborting or inspecting mid-download. */
  hold: () => void;
};

/**
 * Installs a `global.fetch` serving `files` through a `ReadableStream`-shaped body (`getReader`),
 * honoring `init.signal`. Returns the mock; restore with `restoreFetch()`.
 */
export function mockFetch(files: Record<string, MockFile | string>): MockFetch {
  let gate: Promise<void> = Promise.resolve();
  let open: () => void = () => {};
  const abortError = () => {
    const e = new Error('aborted');
    e.name = 'AbortError';
    return e;
  };
  const fn = jest.fn(async (url: string, init?: { signal?: AbortSignal }) => {
    const signal = init?.signal;
    if (signal?.aborted) {
      throw abortError();
    }
    const entry = files[url];
    if (entry === undefined) {
      return { ok: false, status: 404, statusText: 'Not Found' };
    }
    const file: MockFile = typeof entry === 'string' ? { data: entry } : entry;
    if (file.status && file.status >= 400) {
      return { ok: false, status: file.status, statusText: 'Error' };
    }
    const bytes = typeof file.data === 'string' ? new TextEncoder().encode(file.data) : file.data;
    const count = Math.max(1, file.chunks ?? 2);
    const size = Math.ceil(bytes.byteLength / count) || 1;
    let offset = 0;
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: (name: string) =>
          name === 'Content-Length' && file.contentLength !== false ? String(bytes.byteLength) : null,
      },
      body: {
        getReader: () => ({
          read: async () => {
            await gate;
            if (signal?.aborted) {
              throw abortError();
            }
            if (offset >= bytes.byteLength) {
              return { done: true, value: undefined };
            }
            const value = bytes.slice(offset, offset + size);
            offset += size;
            return { done: false, value };
          },
          cancel: async () => {},
        }),
      },
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    };
  }) as unknown as MockFetch;
  fn.hold = () => {
    gate = new Promise<void>(resolve => (open = resolve));
  };
  fn.release = () => open();
  (global as any).fetch = fn;
  return fn;
}

const originalFetch = (global as any).fetch;

export function restoreFetch(): void {
  (global as any).fetch = originalFetch;
}
