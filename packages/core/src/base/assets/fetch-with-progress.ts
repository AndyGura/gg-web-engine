import { abortError, throwIfAborted } from './load-progress';

/**
 * Fetches `url` fully, reporting how many bytes have arrived. The size comes from
 * `Content-Length`; a server that hides it (compressed or cross-origin responses often do) leaves
 * `total` at `null` until the download is complete.
 * @throws an `AbortError` when `signal` aborts, an `Error` on a non-2xx response
 */
export async function fetchWithProgress(
  url: string,
  onBytes?: (loaded: number, total: number | null, done: boolean) => void,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  throwIfAborted(signal);
  let response: Response;
  try {
    response = await (signal ? fetch(url, { signal }) : fetch(url));
  } catch (e) {
    throw signal?.aborted ? abortError() : e;
  }
  if (!response.ok) {
    throw new Error(`Failed to load "${url}": ${response.status} ${response.statusText}`);
  }
  const reader =
    onBytes && response.body && typeof response.body.getReader === 'function' ? response.body.getReader() : null;
  if (!reader) {
    const buffer = await response.arrayBuffer();
    throwIfAborted(signal);
    onBytes?.(buffer.byteLength, buffer.byteLength, true);
    return buffer;
  }
  const header = response.headers?.get('Content-Length');
  // a compressed response reports its compressed size while the stream yields decoded bytes
  const total = header && !response.headers.get('Content-Encoding') ? +header || null : null;
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  while (true) {
    let part: { done: boolean; value?: Uint8Array };
    try {
      part = await reader.read();
    } catch (e) {
      throw signal?.aborted ? abortError() : e;
    }
    if (signal?.aborted) {
      reader.cancel().catch(() => {});
      throw abortError();
    }
    if (part.done) {
      break;
    }
    chunks.push(part.value!);
    loaded += part.value!.byteLength;
    onBytes!(loaded, total !== null && total >= loaded ? total : null, false);
  }
  const result = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onBytes!(loaded, loaded, true);
  return result.buffer;
}
