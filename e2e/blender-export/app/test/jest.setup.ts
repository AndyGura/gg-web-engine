// @gg-web-engine/core assumes a browser (jsdom gives us HTMLInputElement etc. at import time -
// see packages/core/src/base/inputs/keyboard.input.ts), but jsdom's own test environment doesn't
// implement `fetch`, which `Gg3dLoader.loadGgGlbFiles` uses to fetch the fixture from the static
// server in export-load.e2e.spec.ts. Real apps get `fetch` from an actual browser; this is a
// deliberately minimal stand-in providing only the two Response methods that loader actually
// calls (`arrayBuffer()`/`text()`) - not a general-purpose fetch polyfill.
import * as http from 'http';
import { TextDecoder, TextEncoder } from 'util';

// jsdom's test environment doesn't expose these either (GLTFLoader needs TextDecoder to read the
// glTF JSON chunk out of the binary .glb).
if (typeof (globalThis as any).TextDecoder === 'undefined') {
  (globalThis as any).TextDecoder = TextDecoder;
}
if (typeof (globalThis as any).TextEncoder === 'undefined') {
  (globalThis as any).TextEncoder = TextEncoder;
}

if (typeof (globalThis as any).fetch === 'undefined') {
  (globalThis as any).fetch = (url: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; text(): Promise<string> }> =>
    new Promise((resolve, reject) => {
      http
        .get(url, res => {
          const chunks: Buffer[] = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve({
              // Node's Buffer is backed by an ArrayBuffer from Node's own realm, which fails
              // `instanceof ArrayBuffer` checks made by code running in jsdom's realm (e.g.
              // GLTFLoader's binary-vs-JSON sniff) even though it looks identical - copy into a
              // fresh same-realm Uint8Array so the result really is "this realm's" ArrayBuffer.
              arrayBuffer: async () => new Uint8Array(buffer).buffer,
              text: async () => buffer.toString('utf-8'),
            });
          });
          res.on('error', reject);
        })
        .on('error', reject);
    });
}
