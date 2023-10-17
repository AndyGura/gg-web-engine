import { Point3, Point4 } from '../../base';
import { BodyShape3DDescriptor } from './shapes';

export type GgDummy = { name: string; position: Point3; rotation: Point4 } & any;
export type GgCurve = { name: string; cyclic: boolean; points: Point3[] } & any;
export type GgRigidBody = { name: string; position: Point3; rotation: Point4 } & BodyShape3DDescriptor;

export type GgMeta = {
  dummies: GgDummy[];
  curves: GgCurve[];
  rigidBodies: GgRigidBody[];
};
