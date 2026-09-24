import { DebugBody3DSettings, IEntity, ITrigger3dComponent, Shape3DDescriptor } from '@gg-web-engine/core';
import { AmmoWorldComponent } from './ammo-world.component';
import { filter, map, Observable, Subject } from 'rxjs';
import Ammo from '../ammo.js/ammo';
import { AmmoBodyComponent } from './ammo-body.component';
import { AmmoRigidBodyComponent } from './ammo-rigid-body.component';
import { AmmoCharacterControllerComponent } from './ammo-character-controller.component';
import { AmmoGgWorld, AmmoPhysicsTypeDocRepo } from '../types';

export class AmmoTriggerComponent
  extends AmmoBodyComponent<Ammo.btPairCachingGhostObject>
  implements ITrigger3dComponent<AmmoPhysicsTypeDocRepo>
{
  public entity: IEntity | null = null;

  readonly debugBodySettings: DebugBody3DSettings = new DebugBody3DSettings(
    { type: 'TRIGGER', activated: () => this.overlaps.size > 0 },
    this.shape,
  );

  get onEntityEntered(): Observable<AmmoRigidBodyComponent | AmmoCharacterControllerComponent> {
    return this.onEnter$.pipe(
      map(b => AmmoBodyComponent.nativeBodyReverseMap.get(b)),
      filter((x): x is AmmoRigidBodyComponent | AmmoCharacterControllerComponent => !!x),
    );
  }

  get onEntityLeft(): Observable<AmmoRigidBodyComponent | AmmoCharacterControllerComponent | null> {
    return this.onLeft$.pipe(
      map(
        b =>
          (AmmoBodyComponent.nativeBodyReverseMap.get(b) ?? null) as
            AmmoRigidBodyComponent | AmmoCharacterControllerComponent | null,
      ),
    );
  }

  constructor(
    protected readonly world: AmmoWorldComponent,
    protected _nativeBody: Ammo.btPairCachingGhostObject,
    public readonly shape: Shape3DDescriptor,
  ) {
    super(world, _nativeBody, shape);
  }

  protected readonly overlaps: Set<Ammo.btCollisionObject> = new Set<Ammo.btCollisionObject>();
  protected readonly onEnter$: Subject<number> = new Subject<number>();
  protected readonly onLeft$: Subject<number> = new Subject<number>();

  checkOverlaps(): void {
    const numOverlappingObjects = this.nativeBody.getNumOverlappingObjects();
    const newOverlaps = new Set(
      new Array(numOverlappingObjects).fill(null).map((_, i) => this.nativeBody.getOverlappingObject(i)),
    );
    for (const overlap of this.overlaps.keys()) {
      if (!newOverlaps.has(overlap)) {
        this.overlaps.delete(overlap);
        this.onLeft$.next(Ammo.getPointer(overlap));
      } else {
        newOverlaps.delete(overlap);
      }
    }
    for (const newOverlap of newOverlaps) {
      this.overlaps.add(newOverlap);
      this.onEnter$.next(Ammo.getPointer(newOverlap));
    }
  }

  clone(): AmmoTriggerComponent {
    return this.world.factory.createTriggerFromShape(this._nativeBody.getCollisionShape(), this.shape, {
      position: this.position,
      rotation: this.rotation,
    });
  }

  addToWorld(world: AmmoGgWorld) {
    super.addToWorld(world);
    this.world.dynamicAmmoWorld?.addCollisionObject(this.nativeBody, this._ownCGsMask, this._interactWithCGsMask);
    this.overlaps.clear();
  }

  removeFromWorld(world: AmmoGgWorld, dispose?: boolean): void {
    for (const body of this.overlaps) {
      this.onLeft$.next(Ammo.getPointer(body));
    }
    this.overlaps.clear();
    this.world.dynamicAmmoWorld?.removeCollisionObject(this.nativeBody);
    super.removeFromWorld(world, dispose);
  }

  refreshCG(): void {
    this.world.dynamicAmmoWorld?.removeCollisionObject(this.nativeBody);
    this.world.dynamicAmmoWorld?.addCollisionObject(this.nativeBody, this._ownCGsMask, this._interactWithCGsMask);
  }

  /**
   * Mirrors `AmmoRigidBodyComponent.detachFromBroadphaseTemporarily()`/`reattachToBroadphase()` for
   * this trigger's ghost object, backed by `removeCollisionObject`/`addCollisionObject` (the same
   * pair `addToWorld` itself uses, unlike a real rigid body's `removeRigidBody`/`addRigidBody`) -
   * see `AmmoCharacterControllerComponent`'s own doc for why its movement/ground-check queries need
   * every trigger excluded from the collision world for their duration: a trigger is a sensor with
   * no collision response by definition (see `ITrigger3dComponent`), so it must never physically
   * block or "ground" a character the way a real obstacle does.
   */
  detachFromBroadphaseTemporarily(): boolean {
    if (!this.addedToWorld) {
      return false;
    }
    this.world.dynamicAmmoWorld?.removeCollisionObject(this.nativeBody);
    return true;
  }

  /** Undoes `detachFromBroadphaseTemporarily()` - see its own doc. */
  reattachToBroadphase(): void {
    this.world.dynamicAmmoWorld?.addCollisionObject(this.nativeBody, this._ownCGsMask, this._interactWithCGsMask);
  }

  dispose(): void {
    super.dispose();
    this.overlaps.clear();
    this.onEnter$.complete();
    this.onLeft$.complete();
  }
}
