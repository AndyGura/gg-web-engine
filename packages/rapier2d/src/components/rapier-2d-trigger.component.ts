import { Observable, Subject } from 'rxjs';
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier2d-compat';
import { Rapier2dRigidBodyComponent } from './rapier-2d-rigid-body.component';
import { Gg2dWorld, ITrigger2dComponent, IVisualScene2dComponent } from '@gg-web-engine/core';
import { Rapier2dWorldComponent } from './rapier-2d-world.component';

export class Rapier2dTriggerComponent
  extends Rapier2dRigidBodyComponent
  implements ITrigger2dComponent<Rapier2dWorldComponent>
{
  get onEntityEntered(): Observable<Rapier2dRigidBodyComponent> {
    return this.onEnter$.asObservable();
  }

  get onEntityLeft(): Observable<Rapier2dRigidBodyComponent> {
    return this.onLeft$.asObservable();
  }

  protected readonly onEnter$: Subject<Rapier2dRigidBodyComponent> = new Subject<Rapier2dRigidBodyComponent>();
  protected readonly onLeft$: Subject<Rapier2dRigidBodyComponent> = new Subject<Rapier2dRigidBodyComponent>();

  constructor(
    protected readonly world: Rapier2dWorldComponent,
    protected _colliderDescr: ColliderDesc[],
    protected _bodyDescr: RigidBodyDesc,
  ) {
    super(world, _colliderDescr, _bodyDescr, null!);
  }

  addToWorld(world: Gg2dWorld<IVisualScene2dComponent, Rapier2dWorldComponent>): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier2D bodies cannot be shared between different worlds');
    }
    this._nativeBody = this.world.nativeWorld!.createRigidBody(this._bodyDescr);
    this._nativeBodyColliders = this._colliderDescr.map(c =>
      this.world.nativeWorld!.createCollider(c, this._nativeBody!),
    );
    this.world.handleIdEntityMap.set(this._nativeBody!.handle, this);
  }

  checkOverlaps(): void {
    this.world.eventQueue.drainCollisionEvents((h1: any, h2: any, started: any) => {
      let otherBody: Rapier2dRigidBodyComponent | undefined;
      if (h1 === this.nativeBody?.handle) {
        otherBody = this.world.handleIdEntityMap.get(h2);
      } else if (h2 === this.nativeBody?.handle) {
        otherBody = this.world.handleIdEntityMap.get(h1);
      }
      if (!otherBody || !otherBody.entity) return;
      (started ? this.onEnter$ : this.onLeft$).next(otherBody);
    });
  }

  clone(): Rapier2dTriggerComponent {
    const [colliderDescr, bd] = super.factoryProps;
    return new Rapier2dTriggerComponent(this.world, colliderDescr, bd);
  }
}
