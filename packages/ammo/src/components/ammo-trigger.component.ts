import { DebugBody3DSettings, IEntity, ITrigger3dComponent, Shape3DDescriptor } from '@gg-web-engine/core';
import { AmmoWorldComponent } from './ammo-world.component';
import { filter, map, Observable, Subject, Subscription } from 'rxjs';
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
          (typeof b === 'number' ? (AmmoBodyComponent.nativeBodyReverseMap.get(b) ?? null) : b) as
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
    // Proactively drop a tracked overlap the instant its own body leaves the world, rather than
    // waiting for the next checkOverlaps() poll to notice it's gone - `removed$` fires synchronously
    // from `removeFromWorld`, *before* that body's own `dispose()` runs (see
    // `AmmoBodyComponent.removeFromWorld`), so the pointer compared below always still refers to a
    // live handle at the time of comparison. Without this, a body disposed elsewhere while still
    // inside this trigger (e.g. a map chunk's static geometry freed on unload while overlapping the
    // map-bounds trigger) stays in `overlaps` until some future checkOverlaps() call notices it
    // dropped out of the ghost object's live overlap list - by then its native pointer has already
    // been freed and can have been reused for an unrelated new allocation, which
    // `nativeBodyReverseMap` (keyed by raw pointer) then resolves to a completely different,
    // still-live entity: `onEntityLeft` would fire for the wrong entity, and any caller that reacts
    // by removing it (see `Trigger3dEntity`) ends up double-disposing something still in active use.
    //
    // Matched by native pointer, not by object identity: `overlaps` holds whatever wrapper objects
    // `getOverlappingObject()` handed back (embind returns its own wrapper instances for those,
    // stable across repeated calls against the *same* ghost object but not guaranteed to be the
    // *same* JS object as the `nativeBody` a component retains from its own construction, even
    // though both wrap the identical native pointer) - `Ammo.getPointer()` is the only comparison
    // that holds across that gap, same as `nativeBodyReverseMap` already relies on.
    //
    // `onLeft$` itself is deliberately NOT emitted synchronously from here (only the stale entry is
    // purged) - `removed$` can fire from deep inside another component's own in-progress lifecycle
    // operation (found empirically: `CharacterController3dEntity.recreateCapsule()`, mid-swap
    // between its old and new `characterController`, removes the old one with `dispose: true`), and
    // `onLeft$`'s own subscribers (app code, e.g. `Trigger3dEntity`-driven despawn/reset logic) are
    // written assuming they run at a controlled point (this trigger's own tick, via
    // `checkOverlaps()`), not reentrantly nested inside an unrelated component's own removal call
    // stack - reacting synchronously there (e.g. by writing back to the very entity whose component
    // swap is still in progress) corrupted state badly enough to eventually abort the whole Ammo/WASM
    // heap (`Aborted(OOM)`) in testing. Deferred to a microtask instead: still "soon" (same JS turn,
    // well before a same-pointer reallocation could occur) but only ever runs after every currently
    // in-flight synchronous call stack (including whatever triggered this removal) has finished.
    this.removedSub = this.world.removed$.subscribe(component => {
      const removedPointer = Ammo.getPointer((component as AmmoBodyComponent<any>).nativeBody);
      for (const overlap of this.overlaps) {
        if (Ammo.getPointer(overlap) === removedPointer) {
          this.overlaps.delete(overlap);
          // the component itself, not its pointer: a body removed with `dispose` is gone from
          // `nativeBodyReverseMap` by the time the microtask runs
          queueMicrotask(() => this.onLeft$.next(component as AmmoBodyComponent<any>));
          break;
        }
      }
    });
  }

  private readonly removedSub: Subscription;

  protected readonly overlaps: Set<Ammo.btCollisionObject> = new Set<Ammo.btCollisionObject>();
  protected readonly onEnter$: Subject<number> = new Subject<number>();
  /** A native pointer from `checkOverlaps()`, or the removed component itself from the `removed$` reaction. */
  protected readonly onLeft$: Subject<number | AmmoBodyComponent<any>> = new Subject<number | AmmoBodyComponent<any>>();

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
    this.removedSub.unsubscribe();
    super.dispose();
    this.overlaps.clear();
    this.onEnter$.complete();
    this.onLeft$.complete();
  }
}

/**
 * A query resolving a native body/ghost object to its owning component must never treat a
 * `Trigger` as a hit - it's a sensor with no collision response by definition
 * (`ITrigger3dComponent`), so it was never meant to obstruct one. Shared by every JS-side
 * post-filter call site that needs this exact check
 * (`AmmoWorldComponent.raycast()`'s `closestNonTriggerHit`/`solidRayFallback`,
 * `AmmoCharacterControllerComponent.recoverFromPenetration()`) - see `raycast()`'s own doc for why
 * these filter in JS rather than via a broadphase detach.
 */
export function isAmmoTrigger(body: unknown): body is AmmoTriggerComponent {
  return body instanceof AmmoTriggerComponent;
}
