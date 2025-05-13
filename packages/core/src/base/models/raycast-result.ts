import { CollisionGroup } from './body-options';

/**
 * Interface representing the result of a raycast operation.
 *
 * @template D - Data type used for representing physics properties (Point3 for 3D, Point2 for 2D).
 * @template B - Type representing the physics engine's body object.
 */
export interface RaycastResult<D, B> {
  /**
   * Whether the ray hit something.
   */
  hasHit: boolean;

  /**
   * The hit body, if any.
   */
  hitBody?: B;

  /**
   * The hit point in world space, if any.
   */
  hitPoint?: D;

  /**
   * The hit normal in world space, if any.
   */
  hitNormal?: D;

  /**
   * The distance from the ray origin to the hit point, if any.
   */
  hitDistance?: number;
}

/**
 * Interface representing options for a raycast operation.
 *
 * @template D - Data type used for representing physics properties (typically Point3 for 3D).
 */
export interface RaycastOptions<D> {
  /**
   * The starting point of the ray.
   */
  from: D;

  /**
   * The end point of the ray.
   */
  to: D;

  /**
   * Optional collision filter group for the ray.
   */
  collisionFilterGroup?: CollisionGroup | CollisionGroup[];

  /**
   * Optional collision filter mask for the ray.
   */
  collisionFilterMask?: CollisionGroup | CollisionGroup[];
}
