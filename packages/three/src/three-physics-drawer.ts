import { GgDebugPhysicsDrawer, Point3, Point4 } from '@gg-web-engine/core';
import { Gg3dObject } from './impl/gg-3d-object';
import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments } from 'three';

export class ThreePhysicsDrawer extends Gg3dObject implements GgDebugPhysicsDrawer<Point3, Point4> {

  readonly debugBufferSize = 3 * 1000000;
  readonly debugVertices: Float32Array;
  readonly debugColors: Float32Array;

  private index = 0;

  constructor() {
    super(new LineSegments(
      new BufferGeometry(),
      new LineBasicMaterial({ color: 0xff0000, linewidth: 0.5 }),
    ));
    this.debugVertices = new Float32Array(this.debugBufferSize);
    this.debugColors = new Float32Array(this.debugBufferSize);
    (this.nativeMesh as LineSegments).geometry.setAttribute('position', new BufferAttribute(this.debugVertices, 3));
    (this.nativeMesh as LineSegments).geometry.setAttribute('color', new BufferAttribute(this.debugColors, 3));
    (this.nativeMesh as LineSegments).frustumCulled = false;
  }
  drawContactPoint(point: Point3, normal: Point3, color?: Point3): void {
    this.setXYZ(this.debugVertices, this.index, point.x, point.y, point.z);
    this.setXYZ(this.debugColors, this.index++, color?.x || 0, color?.y || 0, color?.z || 0);
    this.setXYZ(this.debugVertices, this.index, point.x + normal.x, point.y + normal.y, point.z + normal.z);
    this.setXYZ(this.debugColors, this.index++, color?.x || 0, color?.y || 0, color?.z || 0);
  }
  drawLine(from: Point3, to: Point3, color?: Point3): void {
    this.setXYZ(this.debugVertices, this.index, from.x, from.y, from.z);
    this.setXYZ(this.debugColors, this.index++, color?.x || 0, color?.y || 0, color?.z || 0);
    this.setXYZ(this.debugVertices, this.index, to.x, to.y, to.z);
    this.setXYZ(this.debugColors, this.index++, color?.x || 0, color?.y || 0, color?.z || 0);
  }

  private lastMaxIndex = 0;

  update() {
    if (this.index < this.lastMaxIndex) {
      this.debugVertices.fill(0, this.index, this.lastMaxIndex);
      this.debugColors.fill(0, this.index, this.lastMaxIndex);
    }
    this.lastMaxIndex = this.index;
    this.index = 0;
    (this.nativeMesh as LineSegments).geometry.attributes.position.needsUpdate = true;
    (this.nativeMesh as LineSegments).geometry.attributes.color.needsUpdate = true;
  }

  private setXYZ(array: Float32Array, index: number, x: number, y: number, z: number) {
    index *= 3;
    array[index] = x;
    array[index + 1] = y;
    array[index + 2] = z;
  };
}
