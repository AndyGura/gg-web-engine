import { Observable, Subject } from 'rxjs';
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d-compat';
import { Rapier3dRigidBodyComponent } from './rapier-3d-rigid-body.component';
import { DebugBody3DSettings, ITrigger3dComponent, Shape3DDescriptor } from '@gg-web-engine/core';
import { Rapier3dWorldComponent } from './rapier-3d-world.component';
import { Rapier3dGgWorld, Rapier3dPhysicsTypeDocRepo } from '../types';

export class Rapier3dTriggerComponent
  extends Rapier3dRigidBodyComponent
  implements ITrigger3dComponent<Rapier3dPhysicsTypeDocRepo>
{
  readonly debugBodySettings: DebugBody3DSettings = new DebugBody3DSettings(
    { type: 'TRIGGER', activated: () => this.overlaps.size > 0 },
    this.shape,
  );

  get onEntityEntered(): Observable<Rapier3dRigidBodyComponent> {
    return this.onEnter$.asObservable();
  }

  get onEntityLeft(): Observable<Rapier3dRigidBodyComponent> {
    return this.onLeft$.asObservable();
  }

  protected readonly overlaps: Set<Rapier3dRigidBodyComponent> = new Set<Rapier3dRigidBodyComponent>();
  protected readonly onEnter$: Subject<Rapier3dRigidBodyComponent> = new Subject<Rapier3dRigidBodyComponent>();
  protected readonly onLeft$: Subject<Rapier3dRigidBodyComponent> = new Subject<Rapier3dRigidBodyComponent>();

  constructor(
    protected readonly world: Rapier3dWorldComponent,
    protected _colliderDescr: ColliderDesc[],
    public readonly shape: Shape3DDescriptor,
    protected _bodyDescr: RigidBodyDesc,
  ) {
    super(world, _colliderDescr, shape, _bodyDescr, null!);
  }

  addToWorld(world: Rapier3dGgWorld): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier3D bodies cannot be shared between different worlds');
    }
    this.overlaps.clear();
    this._nativeBody = this.world.nativeWorld!.createRigidBody(this._bodyDescr);
    this._nativeBodyColliders = this._colliderDescr.map(c =>
      this.world.nativeWorld!.createCollider(c, this._nativeBody!),
    );
    this.world.handleIdEntityMap.set(this._nativeBody!.handle, this);
    this.world.added$.next(this);
  }

  removeFromWorld(world: Rapier3dGgWorld) {
    for (const body of this.overlaps) {
      this.onLeft$.next(body);
    }
    this.overlaps.clear();
    super.removeFromWorld(world);
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
      if (started) {
        this.overlaps.add(otherBody);
        this.onEnter$.next(otherBody);
      } else {
        this.overlaps.delete(otherBody);
        this.onLeft$.next(otherBody);
      }
    });
    for (const body of this.overlaps.keys()) {
      if (!body.nativeBody) {
        this.overlaps.delete(body);
        this.onLeft$.next(body);
      }
    }
  }

  clone(): Rapier3dTriggerComponent {
    const [colliderDescr, sd, bd] = super.factoryProps;
    let component = new Rapier3dTriggerComponent(this.world, colliderDescr, sd, bd);
    component.ownCollisionGroups = this.ownCollisionGroups;
    component.interactWithCollisionGroups = this.interactWithCollisionGroups;
    return component;
  }

  dispose() {
    this.overlaps.clear();
    super.dispose();
  }
}
