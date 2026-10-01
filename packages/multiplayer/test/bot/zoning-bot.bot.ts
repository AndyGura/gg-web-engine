/**
 * Zoning bot harness - validates the wide-ring connection strategy against a real signaling
 * backend. Run on demand (never in CI):
 *
 *   GG_FIREBASE_CONFIG='{"apiKey":"...","projectId":"...","databaseURL":"..."}' npm run bot
 *
 * Optional env: GG_BOT_COUNT (default 6), GG_BOT_SPEED in world units/s (default 40),
 * GG_BOT_CELL (cell size, default 100), GG_BOT_SECONDS (default 60), GG_BOT_ROOM (join an existing
 * room, e.g. one a browser tab is in). Needs a WebRTC implementation for node - install one of
 * `@roamhq/wrtc` or `node-datachannel` (its `polyfill` export) next to this package.
 *
 * Each bot publishes synthetic positions moving back and forth along x at a different phase, so
 * pairs keep crossing into and out of each other's rings. Every 100 ms the harness samples which
 * pairs sit inside each other's stream ring (3×3) but have no open connection; the report lists
 * connection setup times and those "missed" windows. A healthy configuration keeps missed windows
 * to the setup latency of a ring crossing - if they last longer, the connect ring is too small for
 * `speed × setup time` (see the zoning sizing rule in the package README).
 */
// imported file by file: the package index pulls in @gg-web-engine/core, which needs a browser `window`
import { FirebaseSignaling } from '../../src/p2p/firebase-signaling';
import { WebRtcMeshTransport } from '../../src/p2p/webrtc-mesh-transport';
import { withinRing } from '../../src/p2p/zoning';

function loadWebRtc(): typeof RTCPeerConnection {
  if ((globalThis as any).RTCPeerConnection) {
    return (globalThis as any).RTCPeerConnection;
  }
  for (const [name, pick] of [
    ['@roamhq/wrtc', (m: any) => m.RTCPeerConnection],
    ['node-datachannel/polyfill', (m: any) => m.RTCPeerConnection],
  ] as const) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return pick(require(name));
    } catch {
      // try the next one
    }
  }
  throw new Error('No WebRTC implementation for node: npm i --no-save @roamhq/wrtc (or node-datachannel)');
}

const env = (name: string, fallback: number) => (process.env[name] ? Number(process.env[name]) : fallback);

const enabled = !!process.env.GG_FIREBASE_CONFIG;

(enabled ? it : it.skip)('zoning bot harness', async () => {
  const config = JSON.parse(process.env.GG_FIREBASE_CONFIG!);
  const count = env('GG_BOT_COUNT', 6);
  const speed = env('GG_BOT_SPEED', 40);
  const cellSize = env('GG_BOT_CELL', 100);
  const seconds = env('GG_BOT_SECONDS', 60);
  const Rtc = loadWebRtc();
  const roomId = process.env.GG_BOT_ROOM || (await new FirebaseSignaling({ config }).createRoom());
  console.log(`room ${roomId}: ${count} bots, ${speed} u/s, cell ${cellSize}, ${seconds} s`);

  const span = cellSize * 8;
  const bots = Array.from({ length: count }, (_, i) => {
    const transport = new WebRtcMeshTransport({
      signaling: new FirebaseSignaling({ config }),
      roomId,
      localPeerId: `bot${i}`,
      zoning: { cellSize },
      rtcPeerConnection: Rtc,
    });
    const phase = (i / count) * Math.PI * 2;
    const position = (t: number) => ({ x: (span / 2) * Math.sin((speed / span) * t * 2 + phase), y: (i % 2) * cellSize * 0.5 });
    return { id: `bot${i}`, transport, position };
  });

  const start = Date.now();
  await Promise.all(bots.map(b => (b.transport.updateLocalPosition(b.position(0)), b.transport.connect())));
  const missed = new Map<string, number>();
  let samples = 0;
  while (Date.now() - start < seconds * 1000) {
    const t = (Date.now() - start) / 1000;
    for (const b of bots) {
      b.transport.updateLocalPosition(b.position(t));
    }
    samples++;
    for (const a of bots) {
      for (const b of bots) {
        if (a.id < b.id && withinRing(a.transport.localCell, b.transport.localCell, 1) && !a.transport.peers.includes(b.id)) {
          const key = `${a.id}-${b.id}`;
          missed.set(key, (missed.get(key) ?? 0) + 1);
        }
      }
    }
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('connection setup times (ms):');
  for (const b of bots) {
    console.log(`  ${b.id}: ${[...b.transport.setupTimes.entries()].map(([id, ms]) => `${id} ${Math.round(ms)}`).join(', ')}`);
  }
  console.log(`stream-ring pairs without a connection (100 ms samples, of ${samples}):`);
  for (const [pair, n] of missed) {
    console.log(`  ${pair}: ${n} (${(n / 10).toFixed(1)} s)`);
  }
  bots.forEach(b => b.transport.disconnect());
  expect(bots.every(b => b.transport.setupTimes.size > 0)).toBe(true);
});
