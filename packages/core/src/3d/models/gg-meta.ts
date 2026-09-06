import { Point3, Point4 } from '../../base';
import { BodyShape3DDescriptor } from './shapes';

export type GgDummy = { name: string; position: Point3; rotation: Point4 } & any;
export type GgCurve = { name: string; cyclic: boolean; points: Point3[] } & any;
export type GgRigidBody = { name: string; position: Point3; rotation: Point4 } & BodyShape3DDescriptor;

export type GgMeta = {
  /**
   * Written by the Blender exporter (`GG_META_FORMAT_VERSION` in
   * `blender-addon/gg_web_engine_exporter/exporter.py`) since it started declaring one. Absent on
   * `.meta` files exported before that, which is fine - the shape hasn't actually changed yet, so
   * there is nothing to migrate; this only matters once a future export starts writing a `.meta`
   * this loader's current version doesn't understand.
   */
  formatVersion?: number;
  dummies: GgDummy[];
  curves: GgCurve[];
  rigidBodies: GgRigidBody[];
};

/** Highest `.meta` `formatVersion` this loader understands - see `GgMeta.formatVersion`. */
export const GG_META_SUPPORTED_FORMAT_VERSION = 1;
