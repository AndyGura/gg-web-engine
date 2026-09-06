// jest-environment-jsdom (as of jest 30 / jsdom 26) no longer exposes TextEncoder/TextDecoder as
// globals inside the jsdom window, but @dimforge/rapier2d-compat's wasm-bindgen-generated glue
// (rapier_wasm2d.js) references `TextDecoder` at module load time to decode strings coming back
// from the WASM module. Without this polyfill, simply importing anything from
// `@gg-web-engine/rapier2d` inside a jsdom test environment throws
// `ReferenceError: TextDecoder is not defined` before any test body runs.
import { TextDecoder, TextEncoder } from 'util';

if (typeof (global as any).TextEncoder === 'undefined') {
  (global as any).TextEncoder = TextEncoder;
}
if (typeof (global as any).TextDecoder === 'undefined') {
  (global as any).TextDecoder = TextDecoder;
}
