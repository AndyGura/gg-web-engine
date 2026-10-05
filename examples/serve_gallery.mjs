#!/usr/bin/env node
// Serves the examples gallery locally with the same layout the deployed CDN has (see deploy.sh):
// index.html and examples.json at the root, the shared assets/ folder, and each example's dist/
// build mounted at its examples.json `dir`. Build the examples you want to look at first
// (`npm run build` inside the example, or build_examples.sh for all of them), then:
//
//   node examples/serve_gallery.mjs [port]      # default port 8080
//
// No dependencies: this is a plain static file server, nothing is bundled or transformed.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] ?? 8080);
const manifest = (await import(join(root, 'examples.json'), { with: { type: 'json' } })).default;
const exampleDirs = manifest.examples.map(e => e.dir);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.meta': 'application/json',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

/** URL path -> file on disk, mirroring the deployed layout. null when outside anything we serve. */
function resolveFile(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const rel = clean.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '');
  if (rel === '' || rel === 'index.html') return join(root, 'index.html');
  if (rel === 'examples.json') return join(root, 'examples.json');
  if (rel === 'assets' || rel.startsWith(`assets${sep}`)) return join(root, rel);
  const dir = exampleDirs.find(d => rel === d || rel.startsWith(`${d}${sep}`));
  if (!dir) return null;
  const inside = rel.slice(dir.length).replace(/^[/\\]+/, '');
  return join(root, dir, 'dist', inside === '' ? 'index.html' : inside);
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let file = resolveFile(url.pathname);
  if (file && existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file || !resolve(file).startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) {
    console.warn(`404 ${url.pathname}`);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(
      file && file.includes(`${sep}dist${sep}`)
        ? `Not found: ${url.pathname}\n\nIs that example built? Run "npm run build" inside its directory first.\n`
        : `Not found: ${url.pathname}\n`,
    );
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`examples gallery: http://localhost:${port}/`);
  console.log(`serving ${exampleDirs.length} example dirs from their dist/ builds; unbuilt ones 404`);
});
