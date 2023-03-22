import { Point2, Point3 } from './points';

export type GgBox<T> = { min: T; max: T };
export type GgBox2d = GgBox<Point2>;
export type GgBox3d = GgBox<Point3>;
