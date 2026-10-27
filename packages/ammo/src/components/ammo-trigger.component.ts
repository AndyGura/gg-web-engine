import {
  DebugBody3DSettings,
  IEntity,
  ITrigger3dComponent,
  Pnt3,
  Point3,
  Qtrn,
  Shape3DDescriptor,
} from '@gg-web-engine/core';
import { AmmoWorldComponent } from './ammo-world.component';
import { filter, map, Observable, Subject, Subscription } from 'rxjs';
import Ammo from '../ammo.js/ammo';
import { AmmoBodyComponent } from './ammo-body.component';
import { AmmoRigidBodyComponent } from './ammo-rigid-body.component';
import { AmmoCharacterControllerComponent } from './ammo-character-controller.component';
import { AmmoGgWorld, AmmoPhysicsTypeDocRepo } from '../types';

/**
 * `Ammo.wrapPointer(ptr, Class)` turns the raw numeric handle a `ConcreteContactResultCallback`
 * override receives back into a wrapped instance - present at runtime, not declared in
 * `ammo-ambient.d.ts`.
 */
type AmmoWithWrapPointer = typeof Ammo & {
  wrapPointer<T>(ptr: number, type: { new (...args: never[]): T }): T;
};

/** A `testPair` result and the two poses (`readPose`) it was computed for. */
type CachedPairTest = { triggerPose: number[]; pose: number[]; touching: boolean };

/** A collision object's world position and rotation as `[x, y, z, qx, qy, qz, qw]`. */
function readPose(object: Ammo.btCollisionObject): number[] {
  const transform = object.getWorldTransform();
  const origin = transform.getOrigin();
  const rotation = transform.getRotation();
  return [origin.x(), origin.y(), origin.z(), rotation.x(), rotation.y(), rotation.z(), rotation.w()];
}

function samePose(a: number[], b: number[]): boolean {
  for (let i = 0; i < 7; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

let aabbScratchVectors: [Ammo.btVector3, Ammo.btVector3] | null = null;

/** Two module-wide `btVector3`s for `btRigidBody.getAabb` - see `AmmoBodyComponent.scratchVector` for why not `new`. */
function aabbScratch(): [Ammo.btVector3, Ammo.btVector3] {
  aabbScratchVectors ??= [new Ammo.btVector3(), new Ammo.btVector3()];
  return aabbScratchVectors;
}

/** Whether `pointsInsideConvexPart` can ever answer `true` for this shape. */
function canContainAabb(shape: Shape3DDescriptor): boolean {
  switch (shape.shape) {
    case 'BOX':
    case 'SPHERE':
      return true;
    case 'COMPOUND':
      return shape.children.some(c => canContainAabb(c.shape));
    default:
      return false;
  }
}

/**
 * Whether every point (in the shape's local frame) lies inside one single convex part of the
 * shape: the shape itself for a `BOX`/`SPHERE`, or one `COMPOUND` child. The points are the corners
 * of a body's AABB, so all of them inside one convex part means the whole body is inside it. Other
 * shapes answer `false` and are left to the narrowphase.
 */
function pointsInsideConvexPart(shape: Shape3DDescriptor, points: Point3[]): boolean {
  switch (shape.shape) {
    case 'BOX': {
      const hx = shape.dimensions.x / 2;
      const hy = shape.dimensions.y / 2;
      const hz = shape.dimensions.z / 2;
      return points.every(p => Math.abs(p.x) <= hx && Math.abs(p.y) <= hy && Math.abs(p.z) <= hz);
    }
    case 'SPHERE': {
      const r2 = shape.radius * shape.radius;
      return points.every(p => Pnt3.lenSq(p) <= r2);
    }
    case 'COMPOUND':
      return shape.children.some(child => {
        const origin = child.position ?? Pnt3.O;
        const inverse = Qtrn.conjugate(child.rotation ?? Qtrn.O);
        return pointsInsideConvexPart(
          child.shape,
          points.map(p => Pnt3.rot(Pnt3.sub(p, origin), inverse)),
        );
      });
    default:
      return false;
  }
}

const concaveShapes = new WeakMap<Shape3DDescriptor, boolean>();

/**
 * Whether a shape is, or contains, a shape Bullet builds as concave: `MESH`
 * (`btBvhTriangleMeshShape`) or `PLANE` (`btStaticPlaneShape`). Bullet's dispatcher has no
 * collision algorithm for a pair of concave shapes, so two of them never report a contact.
 * Memoized per descriptor object, since `checkOverlaps()` asks it for every candidate every tick.
 */
export function shapeHasConcave(shape: Shape3DDescriptor): boolean {
  let concave = concaveShapes.get(shape);
  if (concave === undefined) {
    concave =
      shape.shape === 'MESH' ||
      shape.shape === 'PLANE' ||
      (shape.shape === 'COMPOUND' && shape.children.some(c => shapeHasConcave(c.shape)));
    concaveShapes.set(shape, concave);
  }
  return concave;
}

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
      // the pointer can be reused by a later allocation: no result recorded for it may outlive it
      this.pairCache.delete(removedPointer);
      this.stepPartners.delete(removedPointer);
      this.stepTouching.delete(removedPointer);
      for (const overlap of this.overlaps) {
        if (Ammo.getPointer(overlap) === removedPointer) {
          this.overlaps.delete(overlap);
          // the component itself, not its pointer: a body removed with `dispose` is gone from
          // `nativeBodyReverseMap` by the time the microtask runs. Resolved through that map now,
          // though, so the component reported leaving is the one `onEntityEntered` reported for
          // this pointer even when another component sharing the native body carried `removed$`
          const left =
            AmmoBodyComponent.nativeBodyReverseMap.get(removedPointer) ?? (component as AmmoBodyComponent<any>);
          queueMicrotask(() => this.onLeft$.next(left));
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

  /** Whether this trigger's shape is or contains a concave shape - see {@link shapeHasConcave}. */
  private readonly concave: boolean = shapeHasConcave(this.shape);

  /**
   * What the last physics step's contact manifolds say about this trigger's pairs, filled by
   * `AmmoWorldComponent` right after each step (`beginStepContacts`/`recordStepManifold`):
   * `stepPartners` holds the pointer of every body the dispatcher kept a manifold with this ghost
   * for, `stepTouching` the ones whose manifold had a contact point at zero or negative distance.
   * Valid while `stepId` equals the world's `stepCount`.
   */
  private stepId = -1;
  private readonly stepPartners = new Set<number>();
  private readonly stepTouching = new Set<number>();

  /**
   * Result of the last `testPair` per candidate pointer, with both poses it was computed for.
   * Rebuilt on every `checkOverlaps()`, so a candidate that left the broadphase list drops out.
   */
  private pairCache = new Map<number, CachedPairTest>();

  /**
   * One `ConcreteContactResultCallback` per trigger, created on first use and freed in `dispose()`,
   * so `checkOverlaps()` allocates nothing native per tick. Its `addSingleResult` override sets
   * `pairTouching` when Bullet reports a contact point at zero or negative distance.
   */
  private contactCallback: Ammo.ConcreteContactResultCallback | null = null;
  private pairTouching = false;

  /** Called by `AmmoWorldComponent` right after a physics step, before it routes the step's manifolds. */
  beginStepContacts(stepId: number): void {
    this.stepId = stepId;
    this.stepPartners.clear();
    this.stepTouching.clear();
  }

  /**
   * Called by `AmmoWorldComponent`'s manifold walk for every manifold between this trigger's ghost
   * object and the body `otherPointer` (several for a `COMPOUND` side: one per touching child).
   */
  recordStepManifold(otherPointer: number, manifold: Ammo.btPersistentManifold, numContacts: number): void {
    this.stepPartners.add(otherPointer);
    if (this.stepTouching.has(otherPointer)) {
      return;
    }
    for (let j = 0; j < numContacts; j++) {
      if (manifold.getContactPoint(j).getDistance() <= 0) {
        this.stepTouching.add(otherPointer);
        return;
      }
    }
  }

  /**
   * Turns the ghost object's broadphase overlap list into the set of bodies whose shapes really
   * overlap this trigger's (touching it, or fully inside it), then emits the difference to the last
   * call as enter/leave events.
   *
   * The ghost's list holds every body whose AABB overlaps the trigger's AABB - the world-space
   * bounding box of the rotated shape, so on its own a box rotated about Z would fire in its
   * bounding box's corners, and a `COMPOUND` anywhere in the union of its children's bounding boxes.
   * Each listed body is decided by the first of these that applies:
   *
   * 1. No component in `nativeBodyReverseMap`: skipped - there is nothing to report.
   * 2. Both shapes concave (`MESH`/`PLANE`, alone or in a `COMPOUND`): Bullet has no collision
   *    algorithm for a concave-vs-concave pair, so no narrowphase ever reports a contact for it.
   *    The broadphase result stands: it overlaps while the AABBs overlap.
   * 3. The last physics step left a manifold for the pair (`stepPartners`): it overlaps if that
   *    step found a contact point at zero or negative distance. The ghost object is never
   *    deactivated, so the dispatcher runs the narrowphase for every one of its pairs on every step,
   *    static and sleeping partners included, and `AmmoWorldComponent`'s manifold walk (which runs
   *    after each step anyway) hands those results here - no second narrowphase. Like the
   *    broadphase list itself, this describes the poses at the last step's collision detection.
   * 4. Otherwise (`testPair`): a body added since the last step, a `COMPOUND` pair none of whose
   *    children's AABBs overlap (the dispatcher keeps no manifold for it), or a trigger that hasn't
   *    been through a step yet. Answered from the cache if neither pose changed since the pair was
   *    last tested, by a JS check if the body's AABB lies inside one convex part of this trigger's
   *    shape, and otherwise by one `contactPairTest`.
   */
  checkOverlaps(): void {
    const collisionWorld = this.world.dynamicAmmoWorld;
    const stepFresh = this.stepId === this.world.stepCount;
    const numOverlappingObjects = this.nativeBody.getNumOverlappingObjects();
    const newOverlaps = new Set<Ammo.btCollisionObject>();
    const nextCache = new Map<number, CachedPairTest>();
    let triggerPose: number[] | null = null;
    for (let i = 0; i < numOverlappingObjects; i++) {
      const candidate = this.nativeBody.getOverlappingObject(i);
      const pointer = Ammo.getPointer(candidate);
      const component = AmmoBodyComponent.nativeBodyReverseMap.get(pointer);
      if (!component || !collisionWorld) {
        continue;
      }
      let touching: boolean;
      if (this.concave && shapeHasConcave(component.shape)) {
        touching = true;
      } else if (stepFresh && this.stepPartners.has(pointer)) {
        touching = this.stepTouching.has(pointer);
      } else {
        triggerPose ??= readPose(this.nativeBody);
        const pose = readPose(candidate);
        const cached = this.pairCache.get(pointer);
        if (cached && samePose(cached.triggerPose, triggerPose) && samePose(cached.pose, pose)) {
          touching = cached.touching;
        } else {
          touching = this.testPair(collisionWorld, candidate, component, triggerPose);
        }
        nextCache.set(pointer, { triggerPose, pose, touching });
      }
      if (touching) {
        newOverlaps.add(candidate);
      }
    }
    this.pairCache = nextCache;
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

  /**
   * Decides one pair with no usable manifold from the last step - see `checkOverlaps()`, case 4.
   * A rigid body whose AABB lies entirely inside one convex part of this trigger's shape (a `BOX` or
   * `SPHERE`, alone or as a `COMPOUND` child) overlaps without a narrowphase; anything else gets one
   * `contactPairTest` (`shapesTouch`).
   */
  private testPair(
    collisionWorld: Ammo.btDiscreteDynamicsWorld,
    candidate: Ammo.btCollisionObject,
    component: AmmoBodyComponent<any>,
    triggerPose: number[],
  ): boolean {
    if (component instanceof AmmoRigidBodyComponent && this.aabbInsideShape(component.nativeBody, triggerPose)) {
      return true;
    }
    return this.shapesTouch(collisionWorld, candidate);
  }

  private aabbInsideShape(body: Ammo.btRigidBody, triggerPose: number[]): boolean {
    if (!canContainAabb(this.shape)) {
      return false;
    }
    const [min, max] = aabbScratch();
    body.getAabb(min, max);
    const lo = { x: min.x(), y: min.y(), z: min.z() };
    const hi = { x: max.x(), y: max.y(), z: max.z() };
    const origin = { x: triggerPose[0], y: triggerPose[1], z: triggerPose[2] };
    const inverse = Qtrn.conjugate({ x: triggerPose[3], y: triggerPose[4], z: triggerPose[5], w: triggerPose[6] });
    const corners: Point3[] = [];
    for (const x of [lo.x, hi.x]) {
      for (const y of [lo.y, hi.y]) {
        for (const z of [lo.z, hi.z]) {
          corners.push(Pnt3.rot(Pnt3.sub({ x, y, z }, origin), inverse));
        }
      }
    }
    return pointsInsideConvexPart(this.shape, corners);
  }

  /** Narrowphase test of one pair - see `testPair()`. */
  private shapesTouch(collisionWorld: Ammo.btDiscreteDynamicsWorld, other: Ammo.btCollisionObject): boolean {
    if (!this.contactCallback) {
      const callback = new Ammo.ConcreteContactResultCallback();
      // embind hands the override raw pointers, not wrapped objects - see `AmmoWithWrapPointer`
      (callback as unknown as { addSingleResult: (...args: number[]) => number }).addSingleResult = (cpPtr: number) => {
        if (!this.pairTouching) {
          const cp = (Ammo as unknown as AmmoWithWrapPointer).wrapPointer(cpPtr, Ammo.btManifoldPoint);
          this.pairTouching = cp.getDistance() <= 0;
        }
        return 0;
      };
      this.contactCallback = callback;
    }
    this.pairTouching = false;
    collisionWorld.contactPairTest(this.nativeBody, other, this.contactCallback);
    return this.pairTouching;
  }

  /** Forgets every per-pair result: after a removal from the world, the pairs are gone. */
  private resetPairState(): void {
    this.stepId = -1;
    this.stepPartners.clear();
    this.stepTouching.clear();
    this.pairCache.clear();
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
    this.world.registerTrigger(this);
    this.overlaps.clear();
    this.resetPairState();
  }

  removeFromWorld(world: AmmoGgWorld, dispose?: boolean): void {
    for (const body of this.overlaps) {
      this.onLeft$.next(Ammo.getPointer(body));
    }
    this.overlaps.clear();
    this.resetPairState();
    this.world.unregisterTrigger(this);
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
    this.world.unregisterTrigger(this);
    this.resetPairState();
    if (this.contactCallback) {
      Ammo.destroy(this.contactCallback);
      this.contactCallback = null;
    }
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
