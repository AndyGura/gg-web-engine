import { Point3, Point4 } from '../../base';

/**
 * Plain-data shape of a {@link Frame3d}: a translation plus a yaw (radians, counter-clockwise about
 * `+Z`, the engine's up axis). Pitch and roll are deliberately not part of it: they would tilt the
 * local `+Z` away from the global one, i.e. tilt gravity.
 */
export interface Frame3dLike {
  /** where the local origin sits, in global coordinates */
  readonly position: Point3;
  /** rotation of the local axes about `+Z`, radians */
  readonly yaw: number;
}

const TWO_PI = Math.PI * 2;

/** wraps an angle to (-PI, PI] */
function wrapYaw(yaw: number): number {
  if (yaw > -Math.PI && yaw <= Math.PI) {
    return yaw;
  }
  let a = yaw % TWO_PI;
  if (a > Math.PI) {
    a -= TWO_PI;
  } else if (a <= -Math.PI) {
    a += TWO_PI;
  }
  return a;
}

/**
 * An immutable rigid placement restricted to translation + yaw about `+Z`: the mapping from a
 * world's local coordinates to global ones, `global = rotZ(yaw) * local + position`.
 *
 * Used as `Gg3dWorld.frame`: a large open world can be split into sections, each simulated in its
 * own world near the origin (where floating-point precision is best), while the section's frame says
 * where that local origin sits globally. Physics stays local; whatever must be comparable across
 * sections (e.g. what a network layer sends) is expressed globally through the conversion helpers.
 *
 * Frames compose like functions: `a.compose(b)` maps `b`'s local space through `b`, then through
 * `a`. The transform taking content from one frame's local coordinates into another's is
 * `newFrame.inverse().compose(oldFrame)`.
 *
 * `yaw` is always kept in (-PI, PI].
 */
export class Frame3d implements Frame3dLike {
  /** The identity frame: local coordinates are global coordinates. */
  static readonly IDENTITY: Frame3d = new Frame3d();

  public readonly position: Point3;
  public readonly yaw: number;
  private readonly cos: number;
  private readonly sin: number;
  /** half-angle sine/cosine: the yaw as a quaternion `{0, 0, sinH, cosH}` */
  private readonly sinH: number;
  private readonly cosH: number;

  constructor(position: Point3 = { x: 0, y: 0, z: 0 }, yaw: number = 0) {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) {
      throw new Error(`Frame3d: position must be finite, got ${JSON.stringify(position)}`);
    }
    if (!Number.isFinite(yaw)) {
      throw new Error(`Frame3d: yaw must be finite, got ${yaw}`);
    }
    this.position = Object.freeze({ x: position.x, y: position.y, z: position.z });
    this.yaw = wrapYaw(yaw);
    this.cos = Math.cos(this.yaw);
    this.sin = Math.sin(this.yaw);
    this.sinH = Math.sin(this.yaw / 2);
    this.cosH = Math.cos(this.yaw / 2);
    Object.freeze(this);
  }

  /** `frame` itself when it already is a `Frame3d`, otherwise a new one with its values. */
  static from(frame: Frame3dLike): Frame3d {
    return frame instanceof Frame3d ? frame : new Frame3d(frame.position, frame.yaw);
  }

  /** `true` when this frame maps every point to itself (zero translation and zero yaw). */
  public get isIdentity(): boolean {
    return this.yaw === 0 && this.position.x === 0 && this.position.y === 0 && this.position.z === 0;
  }

  /** The yaw as a quaternion (rotation about `+Z`). */
  public get rotation(): Point4 {
    return { x: 0, y: 0, z: this.sinH, w: this.cosH };
  }

  /** Local point → global point. */
  public toGlobalPoint(p: Point3): Point3 {
    return {
      x: this.cos * p.x - this.sin * p.y + this.position.x,
      y: this.sin * p.x + this.cos * p.y + this.position.y,
      z: p.z + this.position.z,
    };
  }

  /** Global point → local point. */
  public toLocalPoint(p: Point3): Point3 {
    const dx = p.x - this.position.x;
    const dy = p.y - this.position.y;
    return {
      x: this.cos * dx + this.sin * dy,
      y: -this.sin * dx + this.cos * dy,
      z: p.z - this.position.z,
    };
  }

  /**
   * Local direction → global direction: rotation only, no translation. For anything that is a
   * vector rather than a place: velocities, angular velocities (axis * rate), offsets, normals.
   */
  public toGlobalDirection(v: Point3): Point3 {
    return {
      x: this.cos * v.x - this.sin * v.y,
      y: this.sin * v.x + this.cos * v.y,
      z: v.z,
    };
  }

  /** Global direction → local direction: rotation only, no translation. */
  public toLocalDirection(v: Point3): Point3 {
    return {
      x: this.cos * v.x + this.sin * v.y,
      y: -this.sin * v.x + this.cos * v.y,
      z: v.z,
    };
  }

  /** Local orientation (quaternion) → global orientation: `yawQuat * q`. */
  public toGlobalRotation(q: Point4): Point4 {
    return Frame3d.yawMult(this.sinH, this.cosH, q);
  }

  /** Global orientation (quaternion) → local orientation: `conjugate(yawQuat) * q`. */
  public toLocalRotation(q: Point4): Point4 {
    return Frame3d.yawMult(-this.sinH, this.cosH, q);
  }

  /**
   * `this ∘ inner`: the frame mapping `inner`'s local coordinates to this frame's global ones, i.e.
   * `this.compose(inner).toGlobalPoint(p) === this.toGlobalPoint(inner.toGlobalPoint(p))`.
   */
  public compose(inner: Frame3dLike): Frame3d {
    return new Frame3d(this.toGlobalPoint(inner.position), this.yaw + inner.yaw);
  }

  /** The frame undoing this one: `this.inverse().toGlobalPoint(p) === this.toLocalPoint(p)`. */
  public inverse(): Frame3d {
    return new Frame3d(
      this.toLocalDirection({ x: -this.position.x, y: -this.position.y, z: -this.position.z }),
      -this.yaw,
    );
  }

  /**
   * Whether `other` is the same placement, within `positionEpsilon` per axis and `yawEpsilon`
   * radians (yaw compared on the circle, so `PI` and `-PI + 1e-12` are equal).
   */
  public equals(other: Frame3dLike, positionEpsilon: number = 0, yawEpsilon: number = 0): boolean {
    return (
      Math.abs(this.position.x - other.position.x) <= positionEpsilon &&
      Math.abs(this.position.y - other.position.y) <= positionEpsilon &&
      Math.abs(this.position.z - other.position.z) <= positionEpsilon &&
      Math.abs(wrapYaw(this.yaw - other.yaw)) <= yawEpsilon
    );
  }

  /** Plain JSON: `{ position, yaw }`. */
  public toJSON(): { position: Point3; yaw: number } {
    return { position: { x: this.position.x, y: this.position.y, z: this.position.z }, yaw: this.yaw };
  }

  /** `{0, 0, s, c} * q`, expanded */
  private static yawMult(s: number, c: number, q: Point4): Point4 {
    return {
      x: c * q.x - s * q.y,
      y: c * q.y + s * q.x,
      z: c * q.z + s * q.w,
      w: c * q.w - s * q.z,
    };
  }
}
