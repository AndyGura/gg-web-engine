import { NetStats } from './network-controller';

const REFRESH_MS = 500;

const esc = (value: unknown): string =>
  String(value).replace(/[&<>]/g, c => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));

/**
 * Live network stats overlay (the `net_panel` console command): session, entity counts, traffic rates
 * and one row per connected peer with its round trip, clock offset and snapshot age. Rates are the
 * difference between two readings of the controller's cumulative counters. Browser only.
 */
export class NetDebugPanel {
  private container: HTMLDivElement | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private previous: { at: number; stats: NetStats } | null = null;

  constructor(private readonly read: () => NetStats) {}

  get shown(): boolean {
    return !!this.container;
  }

  set shown(value: boolean) {
    if (value === this.shown || typeof document === 'undefined') {
      return;
    }
    if (value) {
      const container = document.createElement('div');
      container.id = 'gg_net_panel';
      container.style.cssText =
        'position:fixed;left:0;bottom:0;opacity:0.9;z-index:9999;background-color:#333;color:white;' +
        'font:12px monospace;padding:0.25rem 0.5rem;white-space:pre;pointer-events:none';
      document.body.appendChild(container);
      this.container = container;
      this.previous = null;
      this.render();
      this.timer = setInterval(() => this.render(), REFRESH_MS);
    } else {
      clearInterval(this.timer!);
      this.timer = null;
      this.container!.remove();
      this.container = null;
    }
  }

  private render(): void {
    const stats = this.read();
    const at = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const prev = this.previous;
    this.previous = { at, stats };
    const seconds = prev ? Math.max(0.001, (at - prev.at) / 1000) : 0;
    // per-second rate of a cumulative counter since the previous reading
    const rate = (now: number, before: number | undefined): number =>
      seconds > 0 && before !== undefined ? Math.max(0, now - before) / seconds : 0;
    const traffic = (
      label: string,
      now: { messages: number; stateItems: number; bytes: number },
      before: { messages: number; stateItems: number; bytes: number } | undefined,
    ) =>
      `${label}: ${rate(now.messages, before?.messages).toFixed(0)} msg/s, ` +
      `${rate(now.stateItems, before?.stateItems).toFixed(0)} states/s, ` +
      `${(rate(now.bytes, before?.bytes) / 1024).toFixed(1)} kB/s`;
    const lines = [
      `<b>${esc(stats.sessionState)}</b> as ${esc(stats.localPeerId)}, ${stats.peers.length} peer(s)`,
      `entities: ${stats.entities} (${stats.owned} owned, ${stats.possessed} possessed, ${stats.replicas} replicas)`,
      `send rate: ${esc(stats.sendRate)}, keepalive: ${stats.keepaliveRate} Hz`,
      traffic('out', stats.sent, prev?.stats.sent),
      traffic('in ', stats.received, prev?.stats.received),
    ];
    if (stats.droppedUnreliable !== null) {
      lines.push(
        `dropped (send buffer full): ${stats.droppedUnreliable} total, ` +
          `${rate(stats.droppedUnreliable, prev?.stats.droppedUnreliable ?? undefined).toFixed(0)}/s`,
      );
    }
    if (stats.simulatedLag) {
      lines.push(`<span style='color:orange'>simulated lag: ${esc(stats.simulatedLag)}</span>`);
    }
    if (stats.peers.length > 0) {
      const rows = [['peer', 'rtt', 'offset', 'slew', 'sync', 'age', 'states/s', 'kB/s', 'owns', 'heard']];
      for (const p of stats.peers) {
        const before = prev?.stats.peers.find(x => x.peerId === p.peerId);
        const ages = before ? p.stateAgeCount - before.stateAgeCount : 0;
        rows.push([
          p.peerId + (p.away ? ' (away)' : ''),
          `${p.rttMs.toFixed(1)} ms`,
          `${p.offsetMs.toFixed(1)} ms`,
          // what the offset still has to slew to reach the current estimate
          `${(p.targetOffsetMs - p.offsetMs).toFixed(1)} ms`,
          p.clockReady ? `${p.clockSamples}` : `${p.clockSamples} (wait)`,
          ages > 0 ? `${((p.stateAgeSumMs - before!.stateAgeSumMs) / ages).toFixed(1)} ms` : '-',
          rate(p.received.stateItems, before?.received.stateItems).toFixed(0),
          (rate(p.received.bytes, before?.received.bytes) / 1024).toFixed(1),
          `${p.owned}`,
          `${(p.silentMs / 1000).toFixed(1)} s`,
        ]);
      }
      const widths = rows[0].map((_, c) => Math.max(...rows.map(r => r[c].length)));
      lines.push('');
      for (const [i, row] of rows.entries()) {
        const text = row.map((cell, c) => esc(c === 0 ? cell.padEnd(widths[c]) : cell.padStart(widths[c]))).join('  ');
        lines.push(i === 0 ? `<span style='color:#aaa'>${text}</span>` : text);
      }
    }
    this.container!.innerHTML = lines.join('\n');
  }
}
