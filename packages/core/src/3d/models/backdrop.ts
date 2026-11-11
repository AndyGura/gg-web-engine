import { Point3 } from '../../base';

/**
 * Options of a `Backdrop3dEntity` (`Gg3dWorld.addBackdrop`, the `"Backdrop"` level class): how the
 * world's camera maps into the backdrop's miniature space. A main-world global point `P` is seen
 * from the backdrop point `anchorInBackdrop + scale * (P - anchor)`.
 */
export type Backdrop3dOpts = {
  /**
   * Backdrop units per main-world meter. Default `0.0625`: a backdrop is a sixteenth-scale
   * miniature of the land around the level. `0` puts it infinitely far away (the backdrop camera
   * turns with the world's camera but never moves); `1` maps it one to one. Backdrops are drawn in
   * ascending `scale` order, so the smaller the scale, the farther away a backdrop looks.
   */
  scale?: number;
  /** The global main-world point that maps onto `anchorInBackdrop`. Default the origin. */
  anchor?: Point3;
  /** The backdrop point `anchor` maps onto: where the real level sits inside the miniature. Default the origin. */
  anchorInBackdrop?: Point3;
  /**
   * Near and far clipping planes of the backdrop camera, in backdrop units. Default
   * `{ near: 0.05, far: 10000 }`; the world camera's own planes mean nothing across a scale change.
   */
  frustum?: { near: number; far: number };
};

/** `Backdrop3dOpts.scale` when it is left out. */
export const DEFAULT_BACKDROP_SCALE = 1 / 16;

/** `Backdrop3dOpts.frustum` when it is left out. */
export const DEFAULT_BACKDROP_FRUSTUM: Readonly<{ near: number; far: number }> = Object.freeze({
  near: 0.05,
  far: 10000,
});
