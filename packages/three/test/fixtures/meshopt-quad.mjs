// Writes meshopt-quad.glb, the fixture of three-loader.spec.ts: a quad (two triangles) whose
// positions are 16-bit integers (KHR_mesh_quantization, scaled back by the node) and whose vertex
// and index buffers are compressed with EXT_meshopt_compression, both extensions required - the
// layout gltfpack writes. Run from packages/three: `node test/fixtures/meshopt-quad.mjs`.
// `meshoptimizer` (the encoder) is a devDependency of this package, on the minor version three's
// bundled decoder was built from.
import { MeshoptEncoder } from 'meshoptimizer/encoder';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// keep in step with three-loader.spec.ts
const POSITIONS = [
  [-100, -50, 0],
  [100, -50, 0],
  [100, 50, 25],
  [-100, 50, 25],
];
const INDICES = [0, 1, 2, 0, 2, 3];

const pad4 = n => (n + 3) & ~3;

await MeshoptEncoder.ready;

// a VEC3 of shorts is 6 bytes; meshopt attribute streams need a stride divisible by 4
const VERTEX_STRIDE = 8;
const vertices = new Int16Array(POSITIONS.length * (VERTEX_STRIDE / 2));
POSITIONS.forEach((p, i) => vertices.set(p, i * (VERTEX_STRIDE / 2)));
const indices = new Uint16Array(INDICES);

const vertexData = MeshoptEncoder.encodeGltfBuffer(
  new Uint8Array(vertices.buffer),
  POSITIONS.length,
  VERTEX_STRIDE,
  'ATTRIBUTES',
);
const indexData = MeshoptEncoder.encodeGltfBuffer(new Uint8Array(indices.buffer), INDICES.length, 2, 'TRIANGLES');

const indexOffset = pad4(vertexData.length);
const bin = new Uint8Array(pad4(indexOffset + indexData.length));
bin.set(vertexData, 0);
bin.set(indexData, indexOffset);

const min = [0, 1, 2].map(axis => Math.min(...POSITIONS.map(p => p[axis])));
const max = [0, 1, 2].map(axis => Math.max(...POSITIONS.map(p => p[axis])));
const extensions = ['EXT_meshopt_compression', 'KHR_mesh_quantization'];
const json = {
  asset: { version: '2.0', generator: 'gg-web-engine test fixture' },
  extensionsUsed: extensions,
  extensionsRequired: extensions,
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: 'quad', mesh: 0, scale: [0.01, 0.01, 0.01] }],
  meshes: [{ name: 'quad', primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
  accessors: [
    { bufferView: 0, componentType: 5122, count: POSITIONS.length, type: 'VEC3', min, max },
    { bufferView: 1, componentType: 5123, count: INDICES.length, type: 'SCALAR' },
  ],
  bufferViews: [
    {
      buffer: 1,
      byteOffset: 0,
      byteLength: vertices.byteLength,
      byteStride: VERTEX_STRIDE,
      target: 34962,
      extensions: {
        EXT_meshopt_compression: {
          buffer: 0,
          byteOffset: 0,
          byteLength: vertexData.length,
          byteStride: VERTEX_STRIDE,
          count: POSITIONS.length,
          mode: 'ATTRIBUTES',
        },
      },
    },
    {
      buffer: 1,
      byteOffset: vertices.byteLength,
      byteLength: indices.byteLength,
      target: 34963,
      extensions: {
        EXT_meshopt_compression: {
          buffer: 0,
          byteOffset: indexOffset,
          byteLength: indexData.length,
          byteStride: 2,
          count: INDICES.length,
          mode: 'TRIANGLES',
        },
      },
    },
  ],
  buffers: [
    { byteLength: bin.length },
    // the decoded data: no file of its own, the decoder fills it
    {
      byteLength: vertices.byteLength + pad4(indices.byteLength),
      extensions: { EXT_meshopt_compression: { fallback: true } },
    },
  ],
};

const jsonText = JSON.stringify(json);
const jsonChunk = Buffer.alloc(pad4(Buffer.byteLength(jsonText)), ' ');
jsonChunk.write(jsonText);
const chunk = (type, data) => {
  const header = Buffer.alloc(8);
  header.writeUInt32LE(data.length, 0);
  header.writeUInt32LE(type, 4);
  return Buffer.concat([header, data]);
};
const body = Buffer.concat([chunk(0x4e4f534a, jsonChunk), chunk(0x004e4942, Buffer.from(bin))]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + body.length, 8);
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'meshopt-quad.glb'), Buffer.concat([header, body]));
