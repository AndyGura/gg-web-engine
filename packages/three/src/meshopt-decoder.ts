import { warnOnce } from '@gg-web-engine/core';

/**
 * The shape of three's `MeshoptDecoder` (`three/examples/jsm/libs/meshopt_decoder.module.js`),
 * spelled out: @types/three re-exports its type from `meshoptimizer/decoder`, a package `exports`
 * subpath that the `moduleResolution: node` of this package's build can't follow.
 */
export type MeshoptDecoderLike = {
  supported: boolean;
  ready: Promise<void>;
  decodeVertexBuffer: (target: Uint8Array, count: number, size: number, source: Uint8Array, filter?: string) => void;
  decodeIndexBuffer: (target: Uint8Array, count: number, size: number, source: Uint8Array) => void;
  decodeIndexSequence: (target: Uint8Array, count: number, size: number, source: Uint8Array) => void;
  decodeGltfBuffer: (
    target: Uint8Array,
    count: number,
    size: number,
    source: Uint8Array,
    mode: string,
    filter?: string,
  ) => void;
  useWorkers: (count: number) => void;
  decodeGltfBufferAsync: (
    count: number,
    size: number,
    source: Uint8Array,
    mode: string,
    filter?: string,
  ) => Promise<Uint8Array>;
};

/** How long started workers get to answer a first request before decoding moves to the main thread. */
const WORKER_ANSWER_TIMEOUT_MS = 5000;

/** The worker count `useWorkers` asked for; `null` for the default (`defaultWorkerCount`). */
let requestedWorkers: number | null = null;
/** The workers the decoder runs (`useWorkers` called with a count above 0 and answered). */
let runningWorkers = 0;
/** The decoder once loaded, with its workers started; `null` before the first use and after a failed load. */
let decoder: Promise<MeshoptDecoderLike> | null = null;
/** The same decoder, for the synchronous decode functions. */
let loadedDecoder: MeshoptDecoderLike | null = null;

/** Half the cores, 1 to 4; 0 where there are no web workers (a test environment, a server). */
function defaultWorkerCount(): number {
  if (typeof Worker === 'undefined') {
    return 0;
  }
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2;
  return Math.max(1, Math.min(4, Math.floor(cores / 2)));
}

function track(loading: Promise<MeshoptDecoderLike>): Promise<MeshoptDecoderLike> {
  decoder = loading;
  // a failed load (its chunk's download, say) is tried again by the next compressed file
  loading.catch(() => {
    if (decoder === loading) {
      decoder = null;
    }
  });
  return loading;
}

function loadDecoder(): Promise<MeshoptDecoderLike> {
  return (
    decoder ??
    track(
      import('three/examples/jsm/libs/meshopt_decoder.module.js').then(async module => {
        const loaded = (module as unknown as { MeshoptDecoder: MeshoptDecoderLike }).MeshoptDecoder;
        if (!loaded.supported) {
          throw new Error('Decoding a meshopt-compressed glTF needs WebAssembly, which this page does not have');
        }
        await loaded.ready;
        await setWorkers(loaded, requestedWorkers ?? defaultWorkerCount());
        loadedDecoder = loaded;
        return loaded;
      }),
    )
  );
}

/**
 * Has the decoder run `count` workers. They start from a `blob:` url, which a Content Security
 * Policy may refuse - by throwing, or (Chrome) by never running the script, which would leave every
 * decode sent to them unanswered. So they have to answer one request first, or decoding stays on
 * the main thread.
 */
async function setWorkers(loaded: MeshoptDecoderLike, count: number): Promise<void> {
  if (count === runningWorkers) {
    return;
  }
  try {
    loaded.useWorkers(count);
    runningWorkers = count;
  } catch (error) {
    warnOnce('meshopt decoder: web workers could not start, decoding on the main thread.', error);
    stopWorkers(loaded);
    return;
  }
  if (count > 0 && !(await workersAnswer(loaded))) {
    warnOnce(
      'meshopt decoder: web workers did not answer (a Content Security Policy refusing blob: workers?), ' +
        'decoding on the main thread. lazyMeshoptDecoder.useWorkers(0) skips trying.',
    );
    stopWorkers(loaded);
  }
}

function stopWorkers(loaded: MeshoptDecoderLike): void {
  try {
    loaded.useWorkers(0);
  } catch {
    // nothing was started
  }
  runningWorkers = 0;
}

/**
 * Whether the workers answer a request. A worker refused by the page's Content Security Policy is
 * reported as a `securitypolicyviolation`, which ends the wait at once; the timeout covers the rest.
 */
function workersAnswer(loaded: MeshoptDecoderLike): Promise<boolean> {
  const page = typeof document === 'undefined' ? null : document;
  return new Promise(resolve => {
    const settle = (answered: boolean) => {
      clearTimeout(timeout);
      page?.removeEventListener('securitypolicyviolation', refused);
      resolve(answered);
    };
    const refused = (event: SecurityPolicyViolationEvent) => {
      if (event.effectiveDirective === 'worker-src' && event.blockedURI.startsWith('blob')) {
        settle(false);
      }
    };
    const timeout = setTimeout(() => settle(false), WORKER_ANSWER_TIMEOUT_MS);
    // queued as a task, so it can't have fired since `useWorkers` created the workers
    page?.addEventListener('securitypolicyviolation', refused);
    // an empty buffer is malformed: a running worker answers it with an error
    loaded.decodeGltfBufferAsync(0, 4, new Uint8Array(0), 'ATTRIBUTES').then(
      () => settle(true),
      () => settle(true),
    );
  });
}

function requireLoaded(): MeshoptDecoderLike {
  if (!loadedDecoder) {
    throw new Error('lazyMeshoptDecoder: the synchronous decode functions need `await lazyMeshoptDecoder.ready` first');
  }
  return loadedDecoder;
}

/**
 * three's `MeshoptDecoder`, loaded on first use: the module (about 8 kB gzipped, its WebAssembly
 * inlined) is imported, and its WebAssembly compiled, only when a meshopt-compressed buffer
 * (`EXT_meshopt_compression`/`KHR_meshopt_compression`, as `gltfpack -c`/`-cc` writes) is decoded,
 * so an app that never loads one pays nothing. `ThreeLoader` (`world.loader`) uses it; a
 * `GLTFLoader` of an app's own takes it the same way: `new GLTFLoader().setMeshoptDecoder(
 * lazyMeshoptDecoder)`.
 *
 * Buffers are decoded in web workers - half the cores, 1 to 4 - so a large streamed file doesn't
 * stall a frame. `useWorkers(count)` changes that (`0` decodes on the main thread), best before the
 * first compressed file: called later, it resizes the running pool and decodes requested meanwhile
 * wait for it. Workers that can't start or don't answer (a Content Security Policy refusing `blob:`
 * workers) are dropped for the main thread, with a warning. As with three's decoder, the
 * synchronous decode functions need `ready` first.
 */
export const lazyMeshoptDecoder: MeshoptDecoderLike = {
  supported: typeof WebAssembly === 'object',
  get ready(): Promise<void> {
    return loadDecoder().then(() => undefined);
  },
  decodeVertexBuffer: (target, count, size, source, filter) =>
    requireLoaded().decodeVertexBuffer(target, count, size, source, filter),
  decodeIndexBuffer: (target, count, size, source) => requireLoaded().decodeIndexBuffer(target, count, size, source),
  decodeIndexSequence: (target, count, size, source) =>
    requireLoaded().decodeIndexSequence(target, count, size, source),
  decodeGltfBuffer: (target, count, size, source, mode, filter) =>
    requireLoaded().decodeGltfBuffer(target, count, size, source, mode, filter),
  useWorkers: (count: number) => {
    requestedWorkers = count;
    if (decoder) {
      track(decoder.then(loaded => setWorkers(loaded, count).then(() => loaded)));
    }
  },
  decodeGltfBufferAsync: (count, size, source, mode, filter) =>
    loadDecoder().then(loaded => loaded.decodeGltfBufferAsync(count, size, source, mode, filter)),
};
