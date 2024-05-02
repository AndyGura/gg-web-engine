import { Observable, Subject } from 'rxjs';
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d-compat';
import { Rapier3dRigidBodyComponent } from './rapier-3d-rigid-body.component';
import {
  DebugBody3DSettings,
  Gg3dWorld,
  ITrigger3dComponent,
  Shape3DDescriptor,
  VisualTypeDocRepo3D,
} from '@gg-web-engine/core';
import { Rapier3dWorldComponent } from './rapier-3d-world.component';
import { Rapier3dPhysicsTypeDocRepo } from '../types';

export class Rapier3dTriggerComponent
  extends Rapier3dRigidBodyComponent
  implements ITrigger3dComponent<Rapier3dPhysicsTypeDocRepo>
{
  get onEntityEntered(): Observable<Rapier3dRigidBodyComponent> {
    return this.onEnter$.asObservable();
  }

  get onEntityLeft(): Observable<Rapier3dRigidBodyComponent> {
    return this.onLeft$.asObservable();
  }

  protected readonly onEnter$: Subject<Rapier3dRigidBodyComponent> = new Subject<Rapier3dRigidBodyComponent>();
  protected readonly onLeft$: Subject<Rapier3dRigidBodyComponent> = new Subject<Rapier3dRigidBodyComponent>();

  get debugBodySettings(): DebugBody3DSettings {
    return { shape: this.shape, color: 0xffff00 };
  }

  constructor(
    protected readonly world: Rapier3dWorldComponent,
    protected _colliderDescr: ColliderDesc[],
    public readonly shape: Shape3DDescriptor,
    protected _bodyDescr: RigidBodyDesc,
  ) {
    super(world, _colliderDescr, shape, _bodyDescr, null!);
  }

  addToWorld(world: Gg3dWorld<VisualTypeDocRepo3D, Rapier3dPhysicsTypeDocRepo>): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier3D bodies cannot be shared between different worlds');
    }
    this._nativeBody = this.world.nativeWorld!.createRigidBody(this._bodyDescr);
    this._nativeBodyColliders = this._colliderDescr.map(c =>
      this.world.nativeWorld!.createCollider(c, this._nativeBody!),
    );
    this.world.handleIdEntityMap.set(this._nativeBody!.handle, this);
    this.world.added$.next(this);
  }

  checkOverlaps(): void {
    this.world.eventQueue.drainCollisionEvents((h1: any, h2: any, started: any) => {
      let otherBody: Rapier3dRigidBodyComponent | undefined;
      if (h1 === this.nativeBody?.handle) {
        otherBody = this.world.handleIdEntityMap.get(h2);
      } else if (h2 === this.nativeBody?.handle) {
        otherBody = this.world.handleIdEntityMap.get(h1);
      }
      if (!otherBody) return;
      (started ? this.onEnter$ : this.onLeft$).next(otherBody);
    });
  }

  clone(): Rapier3dTriggerComponent {
    const [colliderDescr, sd, bd] = super.factoryProps;
    return new Rapier3dTriggerComponent(this.world, colliderDescr, sd, bd);
  }
}
