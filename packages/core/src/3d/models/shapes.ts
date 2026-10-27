import { Point2, Point3, Point4, warnOnce } from '../../base';
import { Body3DOptions } from './body-options';

/**
 * A cylinder's cross-section radius: either a single `radius` (circular cross-section), or
 * independent `radiusX`/`radiusY` (elliptical cross-section, with `radiusX` along the local X
 * axis and `radiusY` along the local Y axis of the cylinder's ground plane). Passing equal
 * `radiusX`/`radiusY` is equivalent to passing that value as `radius`.
 */
export type CylinderRadius = { radius: number } | { radiusX: number; radiusY: number };

export type Shape3DDescriptor = { collisionMargin?: number } & (
  | { shape: 'PLANE' }
  | { shape: 'BOX'; dimensions: Point3 }
  | { shape: 'CONE'; radius: number; height: number }
  | ({ shape: 'CYLINDER'; height: number } & CylinderRadius)
  | { shape: 'CAPSULE'; radius: number; centersDistance: number }
  | { shape: 'SPHERE'; radius: number }
  | { shape: 'COMPOUND'; children: { position?: Point3; rotation?: Point4; shape: Shape3DDescriptor }[] }
  | { shape: 'CONVEX_HULL'; vertices: Point3[] }
  | { shape: 'MESH'; vertices: Point3[]; faces: [number, number, number][] }
);

export type Shape3DMeshDescriptor =
  | { shape: 'PLANE'; dimensions?: Point2; segments?: Point2 }
  | { shape: 'BOX'; dimensions: Point3; segments?: Point3 }
  | { shape: 'CONE'; radius: number; height: number; radialSegments?: number; heightSegments?: number }
  | ({ shape: 'CYLINDER'; height: number; radialSegments?: number; heightSegments?: number } & CylinderRadius)
  | { shape: 'CAPSULE'; radius: number; centersDistance: number; capSegments?: number; radialSegments?: number }
  | { shape: 'SPHERE'; radius: number; widthSegments?: number; heightSegments?: number }
  | { shape: 'COMPOUND'; children: { position?: Point3; rotation?: Point4; shape: Shape3DMeshDescriptor }[] }
  | { shape: 'CONVEX_HULL'; vertices: Point3[] }
  | { shape: 'MESH'; vertices: Point3[]; faces: [number, number, number][] };

export type BodyShape3DDescriptor = { shape: Shape3DDescriptor; body: Partial<Body3DOptions> };

/**
 * Normalizes a {@link CylinderRadius} to explicit `radiusX`/`radiusY`. When `radiusX === radiusY`
 * (including the plain-`radius` case), every adapter must produce the exact same circular
 * cylinder it did before this field existed.
 */
export function getCylinderRadii(shape: CylinderRadius): { radiusX: number; radiusY: number } {
  return 'radius' in shape ? { radiusX: shape.radius, radiusY: shape.radius } : shape;
}

/**
 * `true` when `descriptor` is one of `kinds`, or a `COMPOUND` with one of them anywhere among its
 * children, however deeply nested.
 */
export function shapeContains(descriptor: Shape3DDescriptor, kinds: readonly Shape3DDescriptor['shape'][]): boolean {
  if (kinds.includes(descriptor.shape)) {
    return true;
  }
  return descriptor.shape === 'COMPOUND' && descriptor.children.some(c => shapeContains(c.shape, kinds));
}

/**
 * `true` when `descriptor` is a `MESH`, or a `COMPOUND` with a `MESH` anywhere among its children.
 */
export function shapeHasMesh(descriptor: Shape3DDescriptor): boolean {
  return shapeContains(descriptor, ['MESH']);
}

/**
 * Logs a one-time warning when a trigger's shape contains a `MESH`. A triangle mesh is a surface
 * with no inside, so a `MESH` trigger reports a body crossing its triangles but not one fully
 * enclosed by them; a volume trigger is a `CONVEX_HULL` or a `COMPOUND` of convex shapes. Called
 * by every physics adapter's `createTrigger`.
 */
export function warnIfMeshTrigger(descriptor: Shape3DDescriptor): void {
  if (shapeHasMesh(descriptor)) {
    warnOnce(
      'A trigger with a MESH shape detects only bodies crossing its triangles, not bodies fully ' +
        'inside it. For a volume trigger use CONVEX_HULL or a COMPOUND of convex shapes.',
    );
  }
}
