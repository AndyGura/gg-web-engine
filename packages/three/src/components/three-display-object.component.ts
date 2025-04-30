import { GgBox3d, IDisplayObject3dComponent, IEntity, Pnt3, Point3, Point4, Qtrn } from '@gg-web-engine/core';
import { Box3, Group, Mesh, Object3D, Scene } from 'three';
import { ThreeGgWorld, ThreeVisualTypeDocRepo } from '../types';

export class ThreeDisplayObjectComponent implements IDisplayObject3dComponent<ThreeVisualTypeDocRepo> {
  entity: IEntity | null = null;

  constructor(public nativeMesh: Object3D) {}

  public get position(): Point3 {
    return Pnt3.clone(this.nativeMesh.position);
  }

  public set position(value: Point3) {
    this.nativeMesh.position.set(value.x, value.y, value.z);
  }

  public get rotation(): Point4 {
    return Qtrn.clone(this.nativeMesh.quaternion);
  }

  public set rotation(value: Point4) {
    this.nativeMesh.quaternion.set(value.x, value.y, value.z, value.w);
  }

  public get scale(): Point3 {
    return Pnt3.clone(this.nativeMesh.scale);
  }

  public set scale(value: Point3) {
    this.nativeMesh.scale.set(value.x, value.y, value.z);
  }

  public get visible(): boolean {
    return this.nativeMesh.visible;
  }

  public set visible(value: boolean) {
    this.nativeMesh.visible = value;
  }

  public get name(): string {
    return this.nativeMesh.name || this.nativeMesh.uuid;
  }

  public set name(value: string) {
    this.nativeMesh.name = value;
  }

  public isEmpty(): boolean {
    if (this.nativeMesh instanceof Scene || this.nativeMesh instanceof Group) {
      return this.nativeMesh.children.length == 0;
    }
    return false;
  }

  popChild(name: string): ThreeDisplayObjectComponent | null {
    const childMesh = this.nativeMesh.children.find(c => c.name === name || c.userData.name === name);
    if (childMesh) {
      childMesh.removeFromParent();
      return new ThreeDisplayObjectComponent(childMesh);
    }
    return null;
  }

  getBoundings(): GgBox3d {
    return new Box3().setFromObject(this.nativeMesh);
  }

  clone(): ThreeDisplayObjectComponent {
    return new ThreeDisplayObjectComponent(this.nativeMesh.clone());
  }

  addToWorld(world: ThreeGgWorld): void {
    world.visualScene.nativeScene?.add(this.nativeMesh);
  }

  removeFromWorld(world: ThreeGgWorld): void {
    world.visualScene.nativeScene?.remove(this.nativeMesh);
  }

  dispose(): void {
    this.nativeMesh.traverse(obj => {
      if (obj instanceof Mesh) {
        this.disposeMesh(obj);
      }
    });
    if (this.nativeMesh instanceof Mesh) {
      this.disposeMesh(this.nativeMesh);
    }
  }

  private disposeMesh(mesh: Mesh) {
    mesh.geometry.dispose();
    const mats = mesh.material instanceof Array ? mesh.material : [mesh.material];
    for (const material of mats) {
      material.dispose();
    }
  }
}
