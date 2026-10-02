/** Zoning configuration of a `WebRtcMeshTransport`. */
export interface ZoningOptions {
  /** side of one square cell over the ground plane (x/y), in world units. Default 100. */
  cellSize: number;
  /** how far (fraction of a cell) a position must cross a boundary before the cell changes. Default 0.1. */
  hysteresis: number;
  /** connect to every peer within this many cells (2 = the 5×5 ring). Default 2. */
  connectRadius: number;
  /** stream state to every peer within this many cells (1 = the 3×3 ring). Default 1. */
  streamRadius: number;
  /** a connection to a peer outside the connect ring is closed after this long. Default 10000. */
  ageOutMs: number;
}

export const DEFAULT_ZONING: Readonly<ZoningOptions> = Object.freeze({
  cellSize: 100,
  hysteresis: 0.1,
  connectRadius: 2,
  streamRadius: 1,
  ageOutMs: 10_000,
});

export interface Cell {
  x: number;
  y: number;
}

export function cellId(cell: Cell | null): string {
  return cell ? `${cell.x}:${cell.y}` : '';
}

export function parseCellId(id: string): Cell | null {
  if (!id) {
    return null;
  }
  const [x, y] = id.split(':').map(Number);
  return isFinite(x) && isFinite(y) ? { x, y } : null;
}

/**
 * Whether two cells are within `radius` cells of each other (Chebyshev distance). A peer with no
 * cell (`''`, e.g. it never reported a position) counts as within every ring.
 */
export function withinRing(a: string, b: string, radius: number): boolean {
  const ca = parseCellId(a);
  const cb = parseCellId(b);
  if (!ca || !cb) {
    return true;
  }
  return Math.abs(ca.x - cb.x) <= radius && Math.abs(ca.y - cb.y) <= radius;
}

/**
 * Maps the local player's position to a coarse grid cell over the ground plane (`x`/`y` - the
 * ground in both 2D and the engine's Z-up 3D), with hysteresis so walking along a boundary doesn't
 * flap between two cells. Sizing rule: the fastest entity's speed × connection setup time must fit
 * inside the connect ring's radius, or peers meet before their connection is up.
 */
export class ZoneTracker {
  private current: Cell | null = null;

  constructor(public readonly options: ZoningOptions = DEFAULT_ZONING) {}

  get cell(): string {
    return cellId(this.current);
  }

  /**
   * Feed the latest position; returns the (possibly unchanged) cell id. `null` (no position: a hidden
   * tab, a spectator) keeps the last cell - an empty cell would put this peer in every ring.
   */
  update(position: { x: number; y: number } | null): string {
    if (!position) {
      return this.cell;
    }
    const size = this.options.cellSize;
    const raw: Cell = { x: Math.floor(position.x / size), y: Math.floor(position.y / size) };
    if (!this.current) {
      this.current = raw;
      return this.cell;
    }
    const margin = size * this.options.hysteresis;
    const minX = this.current.x * size - margin;
    const maxX = (this.current.x + 1) * size + margin;
    const minY = this.current.y * size - margin;
    const maxY = (this.current.y + 1) * size + margin;
    if (position.x < minX || position.x >= maxX || position.y < minY || position.y >= maxY) {
      this.current = raw;
    }
    return this.cell;
  }
}
