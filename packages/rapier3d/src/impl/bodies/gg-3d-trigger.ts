import { Gg3dBody } from './gg-3d-body';
import { GgPositionable3dEntity, IGg3dTrigger } from '@gg-web-engine/core';
import { Observable, Subject } from 'rxjs';
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d';
import { Gg3dPhysicsWorld } from '../gg-3d-physics-world';

export class Gg3dTrigger extends Gg3dBody implements IGg3dTrigger {
  get onEntityEntered(): Observable<GgPositionable3dEntity> {
    return this.onEnter$.asObservable();
  }

  get onEntityLeft(): Observable<GgPositionable3dEntity> {
    return this.onLeft$.asObservable();
  }

  protected readonly onEnter$: Subject<GgPositionable3dEntity> = new Subject<GgPositionable3dEntity>();
  protected readonly onLeft$: Subject<GgPositionable3dEntity> = new Subject<GgPositionable3dEntity>();

  constructor(
    protected readonly world: Gg3dPhysicsWorld,
    protected _colliderDescr: ColliderDesc[],
    protected _bodyDescr: RigidBodyDesc,
  ) {
    super(world, _colliderDescr, _bodyDescr, null!);
  }

  addToWorld(world: Gg3dPhysicsWorld): void {
    if (world != this.world) {
      throw new Error('Rapier3D bodies cannot be shared between different worlds');
    }
    this._nativeBody = this.world.nativeWorld!.createRigidBody(this._bodyDescr);
    this._nativeBodyColliders = this._colliderDescr.map(c =>
      this.world.nativeWorld!.createCollider(c, this._nativeBody!),
    );
    this.world.handleIdEntityMap.set(this._nativeBody.handle, this);
  }

  checkOverlaps(): void {
    this.world.eventQueue.drainCollisionEvents((h1, h2, started) => {
      let otherBody: Gg3dBody | undefined;
      if (h1 === this.nativeBody?.handle) {
        otherBody = this.world.handleIdEntityMap.get(h2);
      } else if (h2 === this.nativeBody?.handle) {
        otherBody = this.world.handleIdEntityMap.get(h1);
      }
      if (!otherBody || !otherBody.entity) return;
      (started ? this.onEnter$ : this.onLeft$).next(otherBody.entity);
    });
  }
}
