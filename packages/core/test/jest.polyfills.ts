// jsdom (jest 30) doesn't expose TextEncoder/TextDecoder, which the loaders decode fetched JSON with
import { TextDecoder, TextEncoder } from 'util';

if (typeof (global as any).TextEncoder === 'undefined') {
  (global as any).TextEncoder = TextEncoder;
}
if (typeof (global as any).TextDecoder === 'undefined') {
  (global as any).TextDecoder = TextDecoder;
}
