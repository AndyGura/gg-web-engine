import {
  Body3DOptions,
  Entity3d,
  Gg3dWorld,
  IRigidBody3dComponent,
  IVisualScene3dComponent,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
} from '@gg-web-engine/core';
import { Collider, ColliderDesc, Quaternion, RigidBody, RigidBodyDesc, Vector3 } from '@dimforge/rapier3d-compat';
import { Rapier3dWorldComponent } from './rapier-3d-world.component';

export class Rapier3dRigidBodyComponent implements IRigidBody3dComponent<Rapier3dWorldComponent> {
  public entity: Entity3d | null = null;

  public get position(): Point3 {
    return Pnt3.clone(this.nativeBody ? this.nativeBody.translation() : this._bodyDescr.translation);
  }

  public set position(value: Point3) {
    if (this.nativeBody) {
      this.nativeBody.setTranslation(new Vector3(value.x, value.y, value.z), false);
    } else {
      this._bodyDescr.setTranslation(value.x, value.y, value.z);
    }
  }

  public get rotation(): Point4 {
    return Qtrn.clone(this.nativeBody ? this.nativeBody.rotation() : this._bodyDescr.rotation);
  }

  public set rotation(value: Point4) {
    if (this.nativeBody) {
      this.nativeBody.setRotation(new Quaternion(value.x, value.y, value.z, value.w), false);
    } else {
      this._bodyDescr.setRotation(new Quaternion(value.x, value.y, value.z, value.w));
    }
  }

  protected _nativeBody: RigidBody | null = null;
  protected _nativeBodyColliders: Collider[] | null = null;

  get nativeBody(): RigidBody | null {
    return this._nativeBody;
  }

  set nativeBody(value: RigidBody | null) {
    if (value == this._nativeBody || !value) {
      return;
    }
    this._nativeBody = value;
  }

  public name: string = '';

  public get factoryProps(): [ColliderDesc[], RigidBodyDesc, Omit<Omit<Body3DOptions, 'dynamic'>, 'mass'>] {
    return [this._colliderDescr, this._bodyDescr, this._colliderOptions];
  }

  constructor(
    protected readonly world: Rapier3dWorldComponent,
    protected _colliderDescr: ColliderDesc[],
    protected _bodyDescr: RigidBodyDesc,
    protected _colliderOptions: Omit<Omit<Body3DOptions, 'dynamic'>, 'mass'>,
  ) {}

  clone(): Rapier3dRigidBodyComponent {
    // TODO probably need to clone factory props to not share the same reference?
    return new Rapier3dRigidBodyComponent(this.world, ...this.factoryProps);
  }

  addToWorld(world: Gg3dWorld<IVisualScene3dComponent, Rapier3dWorldComponent>): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier3D bodies cannot be shared between different worlds');
    }
    this._nativeBody = this.world.nativeWorld!.createRigidBody(this._bodyDescr);
    this._nativeBodyColliders = this._colliderDescr.map(c => {
      const col = this.world.nativeWorld!.createCollider(c, this._nativeBody!);
      col.setFriction(this._colliderOptions.friction);
      col.setRestitution(this._colliderOptions.restitution);
      return col;
    });
    this.world.handleIdEntityMap.set(this._nativeBody!.handle, this);
  }

  removeFromWorld(world: Gg3dWorld<IVisualScene3dComponent, Rapier3dWorldComponent>): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier3D bodies cannot be shared between different worlds');
    }
    if (this._nativeBody) {
      for (const col of this._nativeBodyColliders!) {
        this.world.nativeWorld!.removeCollider(col, false);
      }
      this.world.nativeWorld!.removeRigidBody(this._nativeBody);
      this.world.handleIdEntityMap.delete(this._nativeBody.handle);
      this._nativeBody = null;
      this._nativeBodyColliders = null;
    }
  }

  resetMotion(): void {
    this._nativeBody!.setAngvel(new Vector3(0, 0, 0), false);
    this._nativeBody!.setLinvel(new Vector3(0, 0, 0), false);
  }

  dispose(): void {
    if (this.nativeBody) {
      this.removeFromWorld({ physicsWorld: this.world } as Gg3dWorld<IVisualScene3dComponent, Rapier3dWorldComponent>);
    }
  }
}
