import { Gg3dWorld, IEntity, ITrigger3dComponent, IVisualScene3dComponent } from '@gg-web-engine/core';
import { AmmoWorldComponent } from './ammo-world.component';
import { filter, map, Observable, Subject } from 'rxjs';
import Ammo from 'ammojs-typed';
import { AmmoBodyComponent } from './ammo-body.component';
import { ammoId } from '../ammo-utils';

export class AmmoTriggerComponent
  extends AmmoBodyComponent<Ammo.btPairCachingGhostObject>
  implements ITrigger3dComponent<AmmoWorldComponent>
{
  public entity: IEntity | null = null;

  get onEntityEntered(): Observable<AmmoBodyComponent<any>> {
    return this.onEnter$.pipe(
      map(b => AmmoBodyComponent.nativeBodyReverseMap.get(b)),
      filter(x => !!x),
    ) as Observable<AmmoBodyComponent<any>>;
  }

  get onEntityLeft(): Observable<AmmoBodyComponent<any> | null> {
    return this.onLeft$.pipe(map(b => AmmoBodyComponent.nativeBodyReverseMap.get(b) || null));
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

  addToWorld(world: Gg3dWorld<IVisualScene3dComponent, AmmoWorldComponent>) {
    if (world.physicsWorld != this.world) {
      throw new Error('Ammo triggers cannot be shared between different worlds');
    }
    this.world.dynamicAmmoWorld?.addCollisionObject(this.nativeBody);
    this.overlaps.clear();
  }

  removeFromWorld(world: Gg3dWorld<IVisualScene3dComponent, AmmoWorldComponent>): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Ammo triggers cannot be shared between different worlds');
    }
    for (const body of this.overlaps) {
      this.onLeft$.next(ammoId(body));
    }
    this.overlaps.clear();
    this.world.dynamicAmmoWorld?.removeCollisionObject(this.nativeBody);
  }

  dispose(): void {
    super.dispose();
    this.overlaps.clear();
    this.onEnter$.complete();
    this.onLeft$.complete();
  }

  resetMotion(): void {}
}
