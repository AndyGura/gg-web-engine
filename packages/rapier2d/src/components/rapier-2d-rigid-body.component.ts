import {
  Body2DOptions,
  Entity2d,
  Gg2dWorld,
  IRigidBody2dComponent,
  IVisualScene2dComponent,
  Pnt2,
  Point2,
} from '@gg-web-engine/core';
import { Collider, ColliderDesc, RigidBody, RigidBodyDesc, Vector2 } from '@dimforge/rapier2d-compat';
import { Rapier2dWorldComponent } from './rapier-2d-world.component';

export class Rapier2dRigidBodyComponent implements IRigidBody2dComponent<Rapier2dWorldComponent> {
  public entity: Entity2d | null = null;

  public get position(): Point2 {
    return Pnt2.clone(this.nativeBody ? this.nativeBody.translation() : this._bodyDescr.translation);
  }

  public set position(value: Point2) {
    if (this.nativeBody) {
      this.nativeBody.setTranslation(new Vector2(value.x, value.y), false);
    } else {
      this._bodyDescr.setTranslation(value.x, value.y);
    }
  }

  public get rotation(): number {
    return this.nativeBody ? this.nativeBody.rotation() : this._bodyDescr.rotation;
  }

  public set rotation(value: number) {
    if (this.nativeBody) {
      this.nativeBody.setRotation(value, false);
    } else {
      this._bodyDescr.setRotation(value);
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

  public get factoryProps(): [ColliderDesc[], RigidBodyDesc, Omit<Omit<Body2DOptions, 'dynamic'>, 'mass'>] {
    return [this._colliderDescr, this._bodyDescr, this._colliderOptions];
  }

  constructor(
    protected readonly world: Rapier2dWorldComponent,
    protected _colliderDescr: ColliderDesc[],
    protected _bodyDescr: RigidBodyDesc,
    protected _colliderOptions: Omit<Omit<Body2DOptions, 'dynamic'>, 'mass'>,
  ) {}

  clone(): Rapier2dRigidBodyComponent {
    // TODO probably need to clone factory props to not share the same reference?
    return new Rapier2dRigidBodyComponent(this.world, ...this.factoryProps);
  }

  addToWorld(world: Gg2dWorld<IVisualScene2dComponent, Rapier2dWorldComponent>): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier2D bodies cannot be shared between different worlds');
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

  removeFromWorld(world: Gg2dWorld<IVisualScene2dComponent, Rapier2dWorldComponent>): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier2D bodies cannot be shared between different worlds');
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
    this._nativeBody!.setAngvel(0, false);
    this._nativeBody!.setLinvel(new Vector2(0, 0), false);
  }

  dispose(): void {
    if (this.nativeBody) {
      this.removeFromWorld({ physicsWorld: this.world } as Gg2dWorld<IVisualScene2dComponent, Rapier2dWorldComponent>);
    }
  }
}
