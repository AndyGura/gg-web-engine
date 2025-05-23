import { AmmoWorldComponent } from './ammo-world.component';
import Ammo from '../ammo.js/ammo';
import { AmmoBodyComponent } from './ammo-body.component';
import { DebugBody3DSettings, Entity3d, IRigidBody3dComponent, Point3, Shape3DDescriptor } from '@gg-web-engine/core';
import { first } from 'rxjs';
import { AmmoGgWorld, AmmoPhysicsTypeDocRepo } from '../types';

export class AmmoRigidBodyComponent
  extends AmmoBodyComponent<Ammo.btRigidBody>
  implements IRigidBody3dComponent<AmmoPhysicsTypeDocRepo>
{
  public entity: Entity3d | null = null;

  get linearVelocity(): Point3 {
    const v = this.nativeBody.getLinearVelocity();
    return { x: v.x(), y: v.y(), z: v.z() };
  }

  set linearVelocity(value: Point3) {
    this.nativeBody.setLinearVelocity(new Ammo.btVector3(value.x, value.y, value.z));
  }

  get angularVelocity(): Point3 {
    const v = this.nativeBody.getAngularVelocity();
    return { x: v.x(), y: v.y(), z: v.z() };
  }

  set angularVelocity(value: Point3) {
    this.nativeBody.setAngularVelocity(new Ammo.btVector3(value.x, value.y, value.z));
  }

  readonly debugBodySettings: DebugBody3DSettings = new DebugBody3DSettings(
    this._nativeBody.isStaticOrKinematicObject()
      ? { type: 'RIGID_STATIC' }
      : { type: 'RIGID_DYNAMIC', sleeping: () => !this._nativeBody.isActive() },
    this.shape,
  );

  constructor(
    protected readonly world: AmmoWorldComponent,
    protected _nativeBody: Ammo.btRigidBody,
    public readonly shape: Shape3DDescriptor,
  ) {
    super(world, _nativeBody, shape);
  }

  clone(): AmmoRigidBodyComponent {
    return this.world.factory.createRigidBodyFromShape(
      this._nativeBody.getCollisionShape(),
      this.shape,
      {
        dynamic: !this._nativeBody.isStaticOrKinematicObject(),
        mass: this._nativeBody.getMass(),
        friction: this._nativeBody.getFriction(),
        restitution: this._nativeBody.getRestitution(),
      },
      {
        position: this.position,
        rotation: this.rotation,
      },
    );
  }

  addToWorld(world: AmmoGgWorld): void {
    this.world.dynamicAmmoWorld?.addRigidBody(this.nativeBody, this._ownCGsMask, this._interactWithCGsMask);
    super.addToWorld(world);
  }

  removeFromWorld(world: AmmoGgWorld): void {
    this.world.dynamicAmmoWorld?.removeRigidBody(this.nativeBody);
    super.removeFromWorld(world);
  }

  refreshCG(): void {
    this.world.dynamicAmmoWorld?.removeRigidBody(this.nativeBody);
    this.world.dynamicAmmoWorld?.addRigidBody(this.nativeBody, this._ownCGsMask, this._interactWithCGsMask);
  }

  resetMotion(): void {
    const emptyVector = new Ammo.btVector3();
    if (!this.addedToWorld) {
      this.nativeBody.clearForces();
      this.nativeBody.setLinearVelocity(emptyVector);
      this.nativeBody.setAngularVelocity(emptyVector);
    } else {
      // when resetting object motion state in ammo.js while it's added to the simulation,
      // on the next tick it randomly gets broken (linear velocity vector has NaN components and then position too)
      // By removing and adding the object to the world it happens less often
      const ammoWorld = this.world;
      this.removeFromWorld({ physicsWorld: ammoWorld } as any);
      const position = this.position;
      const rotation = this.rotation;
      this.nativeBody.clearForces();
      this.nativeBody.setLinearVelocity(emptyVector);
      this.nativeBody.setAngularVelocity(emptyVector);
      this.world.afterTick$.pipe(first()).subscribe(() => {
        this.addToWorld({ physicsWorld: ammoWorld } as any);
        const newLinVel = this.linearVelocity;
        if (isNaN(newLinVel.x) || isNaN(newLinVel.y) || isNaN(newLinVel.z)) {
          console.warn('resetMotion caused ammo body to have broken velocity. Fixing');
          this.position = position;
          this.rotation = rotation;
          this.resetMotion();
        }
      });
    }
    Ammo.destroy(emptyVector);
  }
}
