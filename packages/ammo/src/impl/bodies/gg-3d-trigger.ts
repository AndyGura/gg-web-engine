import { Gg3dTriggerEntity, GgPositionable3dEntity, IGg3dTrigger } from '@gg-web-engine/core';
import { Gg3dPhysicsWorld } from '../gg-3d-physics-world';
import { filter, map, Observable, Subject } from 'rxjs';
import Ammo from 'ammojs-typed';
import { BaseAmmoGGBody } from './base-ammo-gg-body';
import { ammoId } from '../../ammo-utils';

export class Gg3dTrigger extends BaseAmmoGGBody<Ammo.btPairCachingGhostObject> implements IGg3dTrigger {

  public entity: Gg3dTriggerEntity | null = null;

  get onEntityEntered(): Observable<GgPositionable3dEntity> {
    return this.onEnter$.pipe(
      map(b => (BaseAmmoGGBody.nativeBodyReverseMap.get(b))?.entity),
      filter(x => !!x && x instanceof GgPositionable3dEntity),
    ) as Observable<GgPositionable3dEntity>;
  }

  get onEntityLeft(): Observable<GgPositionable3dEntity | null> {
    return this.onLeft$.pipe(
      map(b => (BaseAmmoGGBody.nativeBodyReverseMap.get(b))?.entity || null),
    ) as Observable<GgPositionable3dEntity | null>;
  }

  constructor(
    protected readonly world: Gg3dPhysicsWorld,
    protected _nativeBody: Ammo.btPairCachingGhostObject,
  ) {
    super(world, _nativeBody);
  }

  private readonly onEnter$: Subject<number> = new Subject<number>();
  private readonly onLeft$: Subject<number> = new Subject<number>();
  private readonly overlaps: Set<Ammo.btCollisionObject> = new Set<Ammo.btCollisionObject>();

  checkOverlaps(): void {
    const numOverlappingObjects = this.nativeBody.getNumOverlappingObjects();
    const newOverlaps = new Set(new Array(numOverlappingObjects).fill(null).map((_, i) => this.nativeBody.getOverlappingObject(i)));
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

  clone(): Gg3dTrigger {
    return this.world.factory.createTriggerFromShape(
      this._nativeBody.getCollisionShape(), {
        position: this.position,
        rotation: this.rotation,
      }
    );
  }

  addToWorld(world: Gg3dPhysicsWorld) {
    if (world != this.world) {
      throw new Error('Ammo triggers cannot be shared between different worlds');
    }
    world.dynamicAmmoWorld?.addCollisionObject(this.nativeBody);
    this.overlaps.clear();
  }

  removeFromWorld(world: Gg3dPhysicsWorld): void {
    for (const body of this.overlaps) {
      this.onLeft$.next(ammoId(body));
    }
    this.overlaps.clear();
    world.dynamicAmmoWorld?.removeCollisionObject(this.nativeBody);
  }

  dispose(): void {
    super.dispose();
    this.overlaps.clear();
    this.onEnter$.complete();
    this.onLeft$.complete();
  }

  resetMotion(): void {
  }
}
