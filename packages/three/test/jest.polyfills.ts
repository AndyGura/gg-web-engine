// jsdom (jest 30) doesn't expose TextDecoder, which GLTFLoader reads a .glb's JSON chunk with
import { TextDecoder } from 'util';

if (typeof (global as any).TextDecoder === 'undefined') {
  (global as any).TextDecoder = TextDecoder;
}
