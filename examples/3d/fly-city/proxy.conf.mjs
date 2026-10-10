// Serves the shared ../../assets folder at /assets for `ng serve`, like the devServer.static block
// in the webpack examples. Enabled by etc/switch_example_to_local_gg.sh (adds "proxyConfig" to
// angular.json); a standalone clone of this example has no sibling ../../assets, so it stays off.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const assetsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets');
const contentTypes = {
  '.glb': 'model/gltf-binary',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

const server = http.createServer((req, res) => {
  const file = path.join(
    assetsDir,
    decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/assets/, ''),
  );
  if (!file.startsWith(assetsDir + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
server.unref();

export default {
  '/assets': {
    target: `http://127.0.0.1:${server.address().port}`,
    secure: false,
  },
};
