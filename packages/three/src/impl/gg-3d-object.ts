import { IGg3dObject, Point3, Point4, GgBox3d } from '@gg-web-engine/core';
import { Box3, Group, Mesh, Object3D, Scene } from 'three';
import { Gg3dVisualScene } from './gg-3d-visual-scene';

export class Gg3dObject implements IGg3dObject {
  constructor(
    public nativeMesh: Object3D,
  ) {
  }
  public get position(): Point3 {
    return this.nativeMesh.position;
  }

  public set position(value: Point3) {
    this.nativeMesh.position.x = value.x;
    this.nativeMesh.position.y = value.y;
    this.nativeMesh.position.z = value.z;
  }

  public get rotation(): Point4 {
    return this.nativeMesh.quaternion;
  }

  public set rotation(value: Point4) {
    this.nativeMesh.quaternion.x = value.x;
    this.nativeMesh.quaternion.y = value.y;
    this.nativeMesh.quaternion.z = value.z;
    this.nativeMesh.quaternion.w = value.w;
  }

  public get scale(): Point3 {
    return this.nativeMesh.scale;
  }

  public set scale(value: Point3) {
    this.nativeMesh.scale.x = value.x;
    this.nativeMesh.scale.y = value.y;
    this.nativeMesh.scale.z = value.z;
  }

  public get visible(): boolean {
    return this.nativeMesh.visible;
  }

  public set visible(value: boolean) {
    this.nativeMesh.visible = value;
  }

  public name: string = '';

  public isEmpty(): boolean {
    if (this.nativeMesh instanceof Scene || this.nativeMesh instanceof Group) {
      return this.nativeMesh.children.length == 0;
    }
    return false;
  };

  popChild(name: string): Gg3dObject | null {
    const childMesh = this.nativeMesh.children.find(c => c.name === name || c.userData.name === name);
    if (childMesh) {
      childMesh.removeFromParent();
      return new Gg3dObject(childMesh);
    }
    return null;
  };

  getBoundings(): GgBox3d {
    return new Box3().setFromObject(this.nativeMesh);
  }

  clone(): Gg3dObject {
    return new Gg3dObject(this.nativeMesh.clone());
  }

  addToWorld(world: Gg3dVisualScene): void {
    world.nativeScene?.add(this.nativeMesh);
  }

  removeFromWorld(world: Gg3dVisualScene): void {
    world.nativeScene?.remove(this.nativeMesh);
  }

  dispose(): void {
    this.nativeMesh.traverse((obj) => {
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
