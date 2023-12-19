import { Gg3dWorld, IEntity, ITrigger3dComponent, VisualTypeDocRepo3D } from '@gg-web-engine/core';
import { AmmoWorldComponent } from './ammo-world.component';
import { filter, map, Observable, Subject } from 'rxjs';
import Ammo from '../ammo.js/ammo';
import { AmmoBodyComponent } from './ammo-body.component';
import { ammoId } from '../ammo-utils';
import { AmmoRigidBodyComponent } from './ammo-rigid-body.component';
import { AmmoPhysicsTypeDocRepo } from '../types';

export class AmmoTriggerComponent
  extends AmmoBodyComponent<Ammo.btPairCachingGhostObject>
  implements ITrigger3dComponent<AmmoPhysicsTypeDocRepo>
{
  public entity: IEntity | null = null;

  get onEntityEntered(): Observable<AmmoRigidBodyComponent> {
    return this.onEnter$.pipe(
      map(b => AmmoBodyComponent.nativeBodyReverseMap.get(b)),
      filter(x => !!x),
    ) as Observable<AmmoRigidBodyComponent>;
  }

  get onEntityLeft(): Observable<AmmoRigidBodyComponent | null> {
    return this.onLeft$.pipe(
      map(b => AmmoBodyComponent.nativeBodyReverseMap.get(b) || null),
    ) as Observable<AmmoRigidBodyComponent>;
  }

  constructor(protected readonly world: AmmoWorldComponent, protected _nativeBody: Ammo.btPairCachingGhostObject) {
    super(world, _nativeBody);
  }

  protected readonly onEnter$: Subject<number> = new Subject<number>();
  protected readonly onLeft$: Subject<number> = new Subject<number>();
  protected readonly overlaps: Set<Ammo.btCollisionObject> = new Set<Ammo.btCollisionObject>();

  checkOverlaps(): void {
    const numOverlappingObjects = this.nativeBody.getNumOverlappingObjects();
    const newOverlaps = new Set(
      new Array(numOverlappingObjects).fill(null).map((_, i) => this.nativeBody.getOverlappingObject(i)),
    );
    for (const overlap of this.overlaps.keys()) {
      if (!newOverlaps.has(overlap)) {
        this.overlaps.delete(overlap);
        this.onLeft$.next(ammoId(overlap));
      } else {
        newOverlaps.delete(overlap);
      }
    }
    for (const newOverlap of newOverlaps) {
      this.overlaps.add(newOverlap);
      this.onEnter$.next(ammoId(newOverlap));
    }
  }

  clone(): AmmoTriggerComponent {
    return this.world.factory.createTriggerFromShape(this._nativeBody.getCollisionShape(), {
      position: this.position,
      rotation: this.rotation,
    });
  }

  addToWorld(world: Gg3dWorld<VisualTypeDocRepo3D, AmmoPhysicsTypeDocRepo>) {
    super.addToWorld(world);
    this.world.dynamicAmmoWorld?.addCollisionObject(this.nativeBody, this._ownCGsMask, this._interactWithCGsMask);
    this.overlaps.clear();
  }

  removeFromWorld(world: Gg3dWorld<VisualTypeDocRepo3D, AmmoPhysicsTypeDocRepo>): void {
    super.removeFromWorld(world);
    for (const body of this.overlaps) {
      this.onLeft$.next(ammoId(body));
    }
    this.overlaps.clear();
    this.world.dynamicAmmoWorld?.removeCollisionObject(this.nativeBody);
  }

  refreshCG(): void {
    this.world.dynamicAmmoWorld?.removeCollisionObject(this.nativeBody);
    this.world.dynamicAmmoWorld?.addCollisionObject(this.nativeBody, this._ownCGsMask, this._interactWithCGsMask);
  }

  dispose(): void {
    super.dispose();
    this.overlaps.clear();
    this.onEnter$.complete();
    this.onLeft$.complete();
  }
}
