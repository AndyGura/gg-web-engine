import { Frame3d } from './models/frame-3d';

/**
 * The frame a built-in entity converts its network state through: its world's `frame`, read at the
 * moment of the call, or `null` when it has none to apply (no world, or the identity frame - local
 * is global then, and skipping the conversion keeps the values bit-exact). Internal, not exported
 * from the package root: an app reads `world.frame` itself.
 */
export function networkFrameOf(world: unknown): Frame3d | null {
  const frame = (world as { frame?: unknown } | null | undefined)?.frame;
  return frame instanceof Frame3d && !frame.isIdentity ? frame : null;
}
