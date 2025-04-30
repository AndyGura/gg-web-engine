import { map, merge, Observable, Subject } from 'rxjs';
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier2d-compat';
import { Rapier2dRigidBodyComponent } from './rapier-2d-rigid-body.component';
import { DebugBody2DSettings, ITrigger2dComponent, Shape2DDescriptor } from '@gg-web-engine/core';
import { Rapier2dWorldComponent } from './rapier-2d-world.component';
import { Rapier2dGgWorld, Rapier2dPhysicsTypeDocRepo } from '../types';

export class Rapier2dTriggerComponent
  extends Rapier2dRigidBodyComponent
  implements ITrigger2dComponent<Rapier2dPhysicsTypeDocRepo>
{
  get onEntityEntered(): Observable<Rapier2dRigidBodyComponent> {
    return this.onEnter$.asObservable();
  }

  get onEntityLeft(): Observable<Rapier2dRigidBodyComponent> {
    return this.onLeft$.asObservable();
  }

  protected readonly onEnter$: Subject<Rapier2dRigidBodyComponent> = new Subject<Rapier2dRigidBodyComponent>();
  protected readonly onLeft$: Subject<Rapier2dRigidBodyComponent> = new Subject<Rapier2dRigidBodyComponent>();

  readonly debugBodySettings: DebugBody2DSettings = new DebugBody2DSettings(
    { type: 'TRIGGER', activated: () => this.intersectionsAmount > 0 },
    this.shape,
  );

  protected intersectionsAmount = 0;

  constructor(
    protected readonly world: Rapier2dWorldComponent,
    protected _colliderDescr: ColliderDesc[],
    public readonly shape: Shape2DDescriptor,
    protected _bodyDescr: RigidBodyDesc,
  ) {
    super(world, _colliderDescr, shape, _bodyDescr, null!);
    merge(this.onEnter$.pipe(map(() => true)), this.onLeft$.pipe(map(() => false))).subscribe(enter => {
      if (enter) {
        this.intersectionsAmount++;
      } else {
        this.intersectionsAmount--;
      }
    });
  }

  addToWorld(world: Rapier2dGgWorld): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier2D bodies cannot be shared between different worlds');
    }
    this.intersectionsAmount = 0;
    this._nativeBody = this.world.nativeWorld!.createRigidBody(this._bodyDescr);
    this._nativeBodyColliders = this._colliderDescr.map(c =>
      this.world.nativeWorld!.createCollider(c, this._nativeBody!),
    );
    this.world.handleIdEntityMap.set(this._nativeBody!.handle, this);
    this.world.added$.next(this);
  }

  checkOverlaps(): void {
    this.world.eventQueue.drainCollisionEvents((h1: any, h2: any, started: any) => {
      let otherBody: Rapier2dRigidBodyComponent | undefined;
      if (h1 === this.nativeBody?.handle) {
        otherBody = this.world.handleIdEntityMap.get(h2);
      } else if (h2 === this.nativeBody?.handle) {
        otherBody = this.world.handleIdEntityMap.get(h1);
      }
      if (!otherBody) return;
      (started ? this.onEnter$ : this.onLeft$).next(otherBody);
    });
  }

  clone(): Rapier2dTriggerComponent {
    const [colliderDescr, sd, bd] = super.factoryProps;
    const component = new Rapier2dTriggerComponent(this.world, colliderDescr, sd, bd);
    component.ownCollisionGroups = this.ownCollisionGroups;
    component.interactWithCollisionGroups = this.interactWithCollisionGroups;
    return component;
  }
}
