// jest-environment-jsdom (jest 30 / jsdom 27) no longer exposes TextEncoder/TextDecoder as
// globals inside the jsdom sandbox, but @dimforge/rapier3d-compat's wasm-bindgen glue
// (rapier_wasm3d.js) references `TextDecoder`/`TextEncoder` at module top-level (outside of any
// function), so importing it fails at require-time before any test code runs. Polyfill them from
// Node's own `util` module, which does provide them, before the wasm glue module is imported.
import { TextDecoder, TextEncoder } from 'util';

if (typeof (globalThis as any).TextDecoder === 'undefined') {
  (globalThis as any).TextDecoder = TextDecoder;
}
if (typeof (globalThis as any).TextEncoder === 'undefined') {
  (globalThis as any).TextEncoder = TextEncoder;
}
