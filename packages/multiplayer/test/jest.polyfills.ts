// jsdom (jest 30) doesn't expose TextEncoder/TextDecoder, which the rapier WASM glue the in-process
// harness imports needs at module load time - see packages/rapier2d/test/jest.polyfills.ts.
import { TextDecoder, TextEncoder } from 'util';

if (typeof (global as any).TextEncoder === 'undefined') {
  (global as any).TextEncoder = TextEncoder;
}
if (typeof (global as any).TextDecoder === 'undefined') {
  (global as any).TextDecoder = TextDecoder;
}

