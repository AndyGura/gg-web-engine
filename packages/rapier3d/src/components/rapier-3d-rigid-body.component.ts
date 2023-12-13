import {
  Body3DOptions,
  Entity3d,
  Gg3dWorld,
  IRigidBody3dComponent,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  VisualTypeDocRepo3D,
} from '@gg-web-engine/core';
import { Collider, ColliderDesc, Quaternion, RigidBody, RigidBodyDesc, Vector3 } from '@dimforge/rapier3d-compat';
import { Rapier3dWorldComponent } from './rapier-3d-world.component';
import { Rapier3dPhysicsTypeDocRepo } from '../types';

export class Rapier3dRigidBodyComponent implements IRigidBody3dComponent<Rapier3dPhysicsTypeDocRepo> {
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

  get linearVelocity(): Point3 {
    return Pnt3.clone(this.nativeBody?.linvel() || Pnt3.O);
  }

  set linearVelocity(value: Point3) {
    if (this.nativeBody) {
      this.nativeBody.setLinvel(new Vector3(value.x, value.y, value.z), false);
    }
  }

  get angularVelocity(): Point3 {
    return Pnt3.clone(this.nativeBody?.angvel() || Pnt3.O);
  }

  set angularVelocity(value: Point3) {
    if (this.nativeBody) {
      this.nativeBody.setAngvel(new Vector3(value.x, value.y, value.z), false);
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
    const colliderDescr = this._colliderDescr.map(cd => {
      const d = new ColliderDesc(cd.shape);
      d.setTranslation(cd.translation.x, cd.translation.y, cd.translation.z);
      d.setRotation({ ...cd.rotation });
      d.setMassProperties(cd.mass, cd.centerOfMass, cd.principalAngularInertia, cd.angularInertiaLocalFrame);
      d.setFriction(cd.friction);
      d.setEnabled(cd.enabled);
      d.setRestitution(cd.restitution);
      // TODO more fields here?
      return d;
    });
    const bd = new RigidBodyDesc(this._bodyDescr.status);
    bd.mass = this._bodyDescr.mass;
    bd.setTranslation(this._bodyDescr.translation.x, this._bodyDescr.translation.y, this._bodyDescr.translation.z);
    bd.setRotation({ ...this._bodyDescr.rotation });
    // TODO more fields here?
    return [colliderDescr, bd, this._colliderOptions];
  }

  constructor(
    protected readonly world: Rapier3dWorldComponent,
    protected _colliderDescr: ColliderDesc[],
    protected _bodyDescr: RigidBodyDesc,
    protected _colliderOptions: Omit<Omit<Body3DOptions, 'dynamic'>, 'mass'>,
  ) {}

  clone(): Rapier3dRigidBodyComponent {
    return new Rapier3dRigidBodyComponent(this.world, ...this.factoryProps);
  }

  addToWorld(world: Gg3dWorld<VisualTypeDocRepo3D, Rapier3dPhysicsTypeDocRepo>): void {
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

  removeFromWorld(world: Gg3dWorld<VisualTypeDocRepo3D, Rapier3dPhysicsTypeDocRepo>): void {
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
      this.removeFromWorld({ physicsWorld: this.world } as any as Gg3dWorld<
        VisualTypeDocRepo3D,
        Rapier3dPhysicsTypeDocRepo
      >);
    }
  }
}
