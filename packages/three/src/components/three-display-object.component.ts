import {
  DisplayObject3dOpts,
  GgBox3d,
  IDisplayObject3dComponent,
  IEntity,
  IMaterialReadable3dComponent,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  RenderLayer,
} from '@gg-web-engine/core';
import { Box3, Group, Mesh, Object3D, Scene, Texture } from 'three';
import { ThreeGgWorld, ThreeVisualTypeDocRepo } from '../types';

export class ThreeDisplayObjectComponent
  implements
    IDisplayObject3dComponent<ThreeVisualTypeDocRepo>,
    Partial<IMaterialReadable3dComponent<ThreeVisualTypeDocRepo>>
{
  entity: IEntity | null = null;

  /**
   * The options this mesh was actually built with, when constructed via `ThreeFactory.createPrimitive`
   * (or a shortcut built on it) - see `IMaterialReadable3dComponent`'s own doc. Left unset for a mesh
   * built any other way (e.g. a loaded `.glb`), which is the reason this is `Partial` rather than a
   * hard implementation of that interface - check with `isMaterialReadable3d` before relying on it.
   */
  public readonly materialOptions?: DisplayObject3dOpts<Texture>;

  constructor(
    public nativeMesh: Object3D,
    materialOptions?: DisplayObject3dOpts<Texture>,
  ) {
    if (materialOptions) {
      this.materialOptions = materialOptions;
    }
  }

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

  public enableRenderLayer(layer: RenderLayer): void {
    this.nativeMesh.traverse(obj => obj.layers.enable(layer));
  }

  public disableRenderLayer(layer: RenderLayer): void {
    this.nativeMesh.traverse(obj => obj.layers.disable(layer));
  }

  public isRenderLayerEnabled(layer: RenderLayer): boolean {
    return this.nativeMesh.layers.isEnabled(layer);
  }

  public get castShadow(): boolean {
    return this.nativeMesh.castShadow;
  }

  public set castShadow(value: boolean) {
    this.nativeMesh.traverse(obj => (obj.castShadow = value));
  }

  public get receiveShadow(): boolean {
    return this.nativeMesh.receiveShadow;
  }

  public set receiveShadow(value: boolean) {
    this.nativeMesh.traverse(obj => (obj.receiveShadow = value));
  }

  public addChild(child: ThreeDisplayObjectComponent): void {
    // `Object3D.add` already detaches the child from any previous parent
    this.nativeMesh.add(child.nativeMesh);
  }

  public removeChild(child: ThreeDisplayObjectComponent): void {
    if (child.nativeMesh.parent === this.nativeMesh) {
      this.nativeMesh.remove(child.nativeMesh);
    }
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

  removeFromWorld(world: ThreeGgWorld, dispose?: boolean): void {
    world.visualScene.nativeScene?.remove(this.nativeMesh);
    if (dispose) {
      this.dispose();
    }
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
