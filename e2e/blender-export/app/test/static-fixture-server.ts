import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

/**
 * Serves `rootDir` over plain HTTP on an OS-assigned port. `Gg3dLoader.loadGgGlbFiles`
 * fetches `<path>.glb`/`<path>.meta` via the global `fetch`, so the fixture needs to be
 * reachable by URL - this mirrors how a real app loads assets, rather than trying to get
 * Node's `fetch` to read `file://` URLs directly.
 */
export class StaticFixtureServer {
  private server: http.Server | null = null;
  public baseUrl = '';

  async start(rootDir: string): Promise<void> {
    this.server = http.createServer((req, res) => {
      const filePath = path.join(rootDir, decodeURIComponent((req.url || '/').split('?')[0]));
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200);
        res.end(data);
      });
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(0, '127.0.0.1', resolve);
    });
    const address = this.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    this.baseUrl = `http://127.0.0.1:${port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close(err => (err ? reject(err) : resolve()));
    });
  }
}
