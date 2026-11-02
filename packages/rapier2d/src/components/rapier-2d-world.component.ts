import {
  BitMask,
  CollisionEvent,
  CollisionGroup,
  IPhysicsWorld2dComponent,
  Pnt2,
  Pnt3,
  Point2,
  RaycastOptions,
  RaycastResult,
  notInitializedError,
} from '@gg-web-engine/core';
import { Collider, EventQueue, init, QueryFilterFlags, Vector2, World } from '@dimforge/rapier2d-compat';
import { Rapier2dRigidBodyComponent } from './rapier-2d-rigid-body.component';
import { Rapier2dTriggerComponent } from './rapier-2d-trigger.component';
import { Rapier2dCharacterControllerComponent } from './rapier-2d-character-controller.component';
import { Rapier2dFactory } from '../rapier-2d-factory';
import { Rapier2dPhysicsTypeDocRepo } from '../types';
import { Subject } from 'rxjs';

// bodies that get pushed into `children`/`added$`/`removed$` - see Rapier2dWorldComponent's ctor.
type Rapier2dWorldChild = Rapier2dRigidBodyComponent | Rapier2dCharacterControllerComponent;

const RAPIER_ASYNC_INIT = 'Rapier loads its WASM module asynchronously, so `init()` has to be awaited, not just called';

/**
 * The 2D physics world backed by Rapier (`@dimforge/rapier2d-compat`): pass a new one as
 * `physicsWorld` of a `Gg2dWorld`; `world.init()` loads Rapier's WASM build. Works in meters, like
 * every world of this engine. Unlike some other 2D physics adapters, it supports CCD and kinematic
 * bodies and puts resting bodies to sleep - retune after switching.
 *
 * @example
 * ```ts
 * import { Gg2dWorld, TypedGg2dWorld } from '@gg-web-engine/core';
 * import { PixiGgWorld, PixiSceneComponent } from '@gg-web-engine/pixi';
 * import { Rapier2dGgWorld, Rapier2dWorldComponent } from '@gg-web-engine/rapier2d';
 *
 * const world: TypedGg2dWorld<PixiGgWorld, Rapier2dGgWorld> = new Gg2dWorld({
 *   visualScene: new PixiSceneComponent(),
 *   physicsWorld: new Rapier2dWorldComponent(),
 * });
 * await world.init();
 * const native = world.physicsWorld.nativeWorld; // the RAPIER.World itself
 * ```
 */
export class Rapier2dWorldComponent implements IPhysicsWorld2dComponent<Rapier2dPhysicsTypeDocRepo> {
  public readonly backendName: string = 'rapier2d';

  private _factory: Rapier2dFactory | null = null;
  public get factory(): Rapier2dFactory {
    if (!this._factory) {
      throw notInitializedError(
        'Rapier2dWorldComponent',
        'physicsWorld',
        'creating bodies (physicsWorld.factory)',
        RAPIER_ASYNC_INIT,
      );
    }
    return this._factory;
  }

  public readonly added$: Subject<Rapier2dWorldChild> = new Subject();
  public readonly removed$: Subject<Rapier2dWorldChild> = new Subject();
  public readonly children: Rapier2dWorldChild[] = [];

  private _gravity: Point2 = { x: 0, y: 9.82 };
  public get gravity(): Point2 {
    return this._gravity;
  }

  public set gravity(value: Point2) {
    this._gravity = value;
    if (this._nativeWorld) {
      this.nativeWorld.gravity.x = value.x;
      this.nativeWorld.gravity.y = value.y;
    }
  }

  readonly mainCollisionGroup: CollisionGroup = 0;

  protected _nativeWorld: World | null = null;
  public get nativeWorld(): World {
    if (!this._nativeWorld) {
      throw notInitializedError(
        'Rapier2dWorldComponent',
        'physicsWorld',
        'accessing the native Rapier world (nativeWorld)',
        RAPIER_ASYNC_INIT,
      );
    }
    return this._nativeWorld;
  }

  private _eventQueue: EventQueue | null = null;
  public get eventQueue(): EventQueue {
    if (!this._eventQueue) {
      throw notInitializedError(
        'Rapier2dWorldComponent',
        'physicsWorld',
        'reading collision events (eventQueue)',
        RAPIER_ASYNC_INIT,
      );
    }
    return this._eventQueue;
  }

  public readonly handleIdEntityMap: Map<number, Rapier2dWorldChild> = new Map();

  constructor() {
    this.added$.subscribe(c => this.children.push(c));
    this.removed$.subscribe(c => this.children.splice(this.children.indexOf(c), 1));
  }

  async init(): Promise<void> {
    await init();
    this._eventQueue = new EventQueue(true);
    this._nativeWorld = new World(new Vector2(this._gravity.x, this._gravity.y));
    this._factory = new Rapier2dFactory(this);
  }

  /**
   * Bodies with a force/torque applied this tick (`IRigidBodyComponent.applyForce`/`applyTorque`),
   * reset after `simulate()` steps - Rapier otherwise keeps an added force forever.
   */
  public readonly forcedBodies: Set<Rapier2dRigidBodyComponent> = new Set();

  simulate(delta: number): void {
    const world = this._nativeWorld;
    if (!world) {
      return;
    }
    world.timestep = delta / 1000;
    world.step(this.eventQueue);
    // delivered only after the queue is drained, so no subscriber runs (and changes the world)
    // from inside the drain
    const pendingEvents: (() => void)[] = [];
    this.collectCollisionEvents(pendingEvents);
    for (const body of this.forcedBodies) {
      body.resetAppliedForces();
    }
    this.forcedBodies.clear();
    for (const notify of pendingEvents) {
      notify();
    }
  }

  /**
   * Drains `eventQueue` and routes each entry to whichever component(s) care, as a notification
   * pushed to `out` - `simulate()` calls it right after `World.step()` (the queue is created with
   * `autoDrain`, so Rapier clears it before the next step) and runs the notifications once the
   * drain is done. Contact geometry and velocities are read here, right after the step the contact
   * started in. This is the *only* place `drainCollisionEvents` is called for the whole world:
   * `drainCollisionEvents` empties the whole (shared, single) queue, so any second consumer draining
   * it - a trigger, say - would race this one for the same events. `Rapier2dTriggerComponent
   * .checkOverlaps()`, called by `Trigger2dEntity` every tick, drains nothing - see its own doc.
   * A collider pair with sensor semantics (either side a `Rapier2dTriggerComponent`) is routed as a
   * trigger overlap; an ordinary pair is routed as a real rigid-body collision.
   *
   * `EventQueue.drainCollisionEvents` reports *collider* handles, not rigid-body handles -
   * `handleIdEntityMap` is keyed by rigid-body handle (see `addToWorld`), so each handle is resolved
   * via `ColliderSet.get` then `Collider.parent()` to reach the owning `RigidBody` before the map
   * lookup. A removed collider's stop arrives at the next step under its old handle, and
   * `ColliderSet.get` looks a handle up by its arena index alone, ignoring the generation: once a
   * new collider has taken the freed slot, the old handle resolves to *that* collider (of whichever
   * body created it - possibly the same body re-added). Such an event is skipped unless the
   * resolved collider's own `handle` equals the reported one; an unoccupied slot gives `null`.
   *
   * Components are resolved here, at collection time, and every notification captures both native
   * body handles: an earlier notification's subscriber - or the first side's own subscriber, for
   * the second side - may remove either side (a pickup removing the body it caught) or remove and
   * re-add it under a new native body, so each side's notification is dropped when either
   * component's `nativeBody?.handle` no longer matches right before it runs - that body is no
   * longer in the world (or is a different native body), and its stop has already been accounted
   * for by `removeFromWorld`.
   *
   * `handleIdEntityMap` also holds `Rapier2dCharacterControllerComponent`s, so `c1`/`c2` below can
   * each be a character controller as well as a rigid body/trigger - the sensor branch handles that
   * directly (`handleOverlapEvent` accepts either), while the real-contact branch narrows to
   * `Rapier2dRigidBodyComponent` first, since a character controller has no collision-event API to
   * call into.
   */
  protected collectCollisionEvents(out: (() => void)[]): void {
    const nativeWorld = this._nativeWorld;
    if (!nativeWorld) {
      return;
    }
    this.eventQueue.drainCollisionEvents((h1, h2, started) => {
      const collider1 = nativeWorld.colliders.get(h1);
      const collider2 = nativeWorld.colliders.get(h2);
      // a stale handle of a removed collider resolves to whichever collider took its slot since
      if (!collider1 || !collider2 || collider1.handle !== h1 || collider2.handle !== h2) {
        return;
      }
      const body1 = collider1.parent();
      const body2 = collider2.parent();
      if (!body1 || !body2) {
        return;
      }
      const c1 = this.handleIdEntityMap.get(body1.handle);
      const c2 = this.handleIdEntityMap.get(body2.handle);
      // `c1 === c2` happens for a compound body's own sub-colliders touching each other (e.g. two
      // parts of the same multi-collider rigid body briefly overlapping) - not a real collision
      // between two bodies, so it must never reach a component's own onCollisionStart/onCollisionEnd
      // stream.
      if (!c1 || !c2 || c1 === c2) {
        return;
      }
      const handle1 = body1.handle;
      const handle2 = body2.handle;
      // re-checked right before each side's own notification, not once per pair: the first side's
      // subscriber may remove the second (see the doc above)
      const current = () => c1.nativeBody?.handle === handle1 && c2.nativeBody?.handle === handle2;

      if (collider1.isSensor() || collider2.isSensor()) {
        // sensor overlap (at least one side is a trigger) - a trigger has no collision response,
        // so this must never reach the plain-rigid-body onCollisionStart/onCollisionEnd path.
        out.push(() => {
          if (c1 instanceof Rapier2dTriggerComponent && current()) {
            c1.handleOverlapEvent(c2, started);
          }
          if (c2 instanceof Rapier2dTriggerComponent && current()) {
            c2.handleOverlapEvent(c1, started);
          }
        });
        return;
      }

      // A character controller has no real-contact API (`notifyCollisionStart`/`notifyCollisionEnd`)
      // to call into - its own sweep-based `move()` already handles physical response, so a
      // non-sensor pair involving one is simply not reported as a collision event (sensor pairs
      // above are unaffected - `handleOverlapEvent` accepts either component type).
      if (!(c1 instanceof Rapier2dRigidBodyComponent) || !(c2 instanceof Rapier2dRigidBodyComponent)) {
        return;
      }

      if (started) {
        // a start is never dropped, even without a manifold: the bodies count their touching
        // collider pairs (see `Rapier2dRigidBodyComponent.collidingWith`), and the stop of this
        // pair will come either way
        const geometry =
          this.computeContactGeometry(collider1, collider2) ?? this.fallbackContactGeometry(body1, body2);
        const v1 = Pnt2.clone(body1.linvel());
        const v2 = Pnt2.clone(body2.linvel());
        out.push(() => {
          if (!current()) {
            return;
          }
          // both sides count the pair before either emits - see `trackCollisionStart`
          const first1 = c1.trackCollisionStart(c2);
          const first2 = c2.trackCollisionStart(c1);
          if (first1 && current()) {
            c1.emitCollisionStart({
              otherBody: c2,
              position: geometry.position,
              normal: geometry.normal,
              relativeVelocity: Pnt2.sub(v2, v1),
              impulse: geometry.impulse,
            });
          }
          if (first2 && current()) {
            c2.emitCollisionStart({
              otherBody: c1,
              position: geometry.position,
              normal: Pnt2.neg(geometry.normal),
              relativeVelocity: Pnt2.sub(v1, v2),
              impulse: geometry.impulse,
            });
          }
        });
      } else {
        out.push(() => {
          if (!current()) {
            return;
          }
          const last1 = c1.trackCollisionEnd(c2);
          const last2 = c2.trackCollisionEnd(c1);
          if (last1 && current()) {
            c1.emitCollisionEnd(c2);
          }
          if (last2 && current()) {
            c2.emitCollisionEnd(c1);
          }
        });
      }
    });
  }

  /**
   * Reads world-space contact position/normal/impulse for a just-started contact between two
   * non-sensor colliders via `World.contactPair`'s `TempContactManifold`. Returns `null` only if the
   * pair has no manifold at all (a manifold can legitimately be empty the same step a `started`
   * event is reported for it: the narrow-phase pass that produced the event and the manifold read
   * back here are the same pass, but Rapier doesn't guarantee a manifold survives with contact data
   * intact for every shape pair across that boundary). Each sub-collider pair of a `COMPOUND` body
   * gets its own `drainCollisionEvents` entry (collision events are per *collider*), so a single
   * call here only ever sees one manifold; only the first encountered is used regardless.
   *
   * `impulse` sums `contactImpulse(i)` across every contact point of that manifold - the actual
   * per-contact impulse already solved by Rapier for this step, not an approximation, so it's
   * directly comparable across hits from this adapter. `position` is the first solver contact point
   * (already world-space). `normal` is returned oriented "away from `collider1` towards
   * `collider2`": `contactPair(a, b, f)` reports via the callback's `flipped` flag whether its own
   * internally-cached manifold order matches the queried `(a, b)` order; when `flipped` is `true`
   * the manifold's `normal()` (world-space, from the manifold's own shape1 to shape2) points from
   * `collider2` to `collider1` and is negated to match this method's documented orientation.
   */
  protected computeContactGeometry(
    collider1: Collider,
    collider2: Collider,
  ): { position: Point2; normal: Point2; impulse: number } | null {
    const nativeWorld = this._nativeWorld;
    if (!nativeWorld) {
      return null;
    }
    let result: { position: Point2; normal: Point2; impulse: number } | null = null;
    nativeWorld.contactPair(collider1, collider2, (manifold, flipped) => {
      if (result) {
        // only the first manifold is used - see doc above.
        return;
      }
      const n = manifold.normal();
      const normal: Point2 = flipped ? { x: -n.x, y: -n.y } : { x: n.x, y: n.y };
      let position: Point2 | null = null;
      if (manifold.numSolverContacts() > 0) {
        const p = manifold.solverContactPoint(0);
        if (p) {
          position = { x: p.x, y: p.y };
        }
      }
      let impulse = 0;
      for (let i = 0; i < manifold.numContacts(); i++) {
        impulse += manifold.contactImpulse(i);
      }
      result = {
        position: position ?? Pnt2.avg(Pnt2.clone(collider1.translation()), Pnt2.clone(collider2.translation())),
        normal,
        impulse,
      };
    });
    return result;
  }

  /**
   * Contact geometry for a started pair `computeContactGeometry` found no manifold for: the midpoint
   * of the two bodies, the direction from `body1` to `body2` (`+Y` when they coincide), no impulse.
   */
  protected fallbackContactGeometry(
    body1: { translation(): Point2 },
    body2: { translation(): Point2 },
  ): { position: Point2; normal: Point2; impulse: number } {
    const p1 = Pnt2.clone(body1.translation());
    const p2 = Pnt2.clone(body2.translation());
    const between = Pnt2.sub(p2, p1);
    return {
      position: Pnt2.avg(p1, p2),
      normal: Pnt2.len(between) > 1e-9 ? Pnt2.norm(between) : Pnt2.Y,
      impulse: 0,
    };
  }

  protected lockedCollisionGroups: number[] = [];

  registerCollisionGroup(): CollisionGroup {
    for (let i = 1; i < 16; i++) {
      if (!this.lockedCollisionGroups.includes(i)) {
        this.lockedCollisionGroups.push(i);
        return i;
      }
    }
    throw new Error('App tries to register 17th collision group, but rapier 2D supports only 16');
  }

  deregisterCollisionGroup(group: CollisionGroup): void {
    this.lockedCollisionGroups = this.lockedCollisionGroups.filter(x => x !== group);
  }

  /**
   * `castRay`'s own default (no `filterFlags`) treats a sensor collider as a solid obstacle, exactly
   * like any real one - `QueryFilterFlags.EXCLUDE_SENSORS` is required so a raycast never reports a
   * hit against a `Trigger`'s own collider, matching what "trigger" means everywhere else in this
   * engine (a sensor with no collision response, see `ITrigger2dComponent`).
   */
  raycast(options: RaycastOptions<Point2>): RaycastResult<Point2, Rapier2dRigidBodyComponent> {
    if (!this._nativeWorld) {
      return { hasHit: false };
    }
    const origin = options.from;
    let direction = Pnt2.sub(options.to, options.from);
    const rayLength = Pnt2.len(direction);
    direction = Pnt2.norm(direction);
    const ray = {
      origin: new Vector2(...Pnt2.spr(origin)),
      dir: new Vector2(...Pnt2.spr(direction)),
      pointAt: (t: number) => {
        return new Vector2(origin.x + direction.x * t, origin.y + direction.y * t);
      },
    };
    const mask = (groups?: CollisionGroup[]) => {
      return groups ? BitMask.pack(groups, 16) : BitMask.full(16);
    };
    const hit = this._nativeWorld.castRay(
      ray,
      rayLength,
      true,
      QueryFilterFlags.EXCLUDE_SENSORS,
      (mask(options.collisionFilterGroups) << 16) | mask(options.collisionFilterMask),
    );
    if (!hit) {
      return { hasHit: false };
    }
    const result: RaycastResult<Point2, Rapier2dRigidBodyComponent> = {
      hasHit: true,
    };
    const collider = hit.collider;
    if (collider) {
      const rigidBody = collider.parent();
      if (!rigidBody) {
        return { hasHit: false };
      }
      // `handleIdEntityMap` also holds character controllers (see its own doc) - `raycast`'s
      // contract only promises `PTypeDoc['rigidBody'] | PTypeDoc['trigger']`, so a hit against one
      // is filtered out here rather than surfaced as `hitBody`, mirroring
      // `Rapier3dWorldComponent.raycast`'s identical filter.
      const resolvedHitBody = this.handleIdEntityMap.get(rigidBody.handle);
      result.hitBody = resolvedHitBody instanceof Rapier2dRigidBodyComponent ? resolvedHitBody : undefined;
      result.hitDistance = hit.timeOfImpact;
      result.hitPoint = Pnt2.add(origin, Pnt2.scalarMult(direction, hit.timeOfImpact));

      const rayIntersection = hit.collider.castRayAndGetNormal(ray, hit.timeOfImpact, true);
      result.hitNormal = Pnt2.clone(rayIntersection?.normal || Pnt3.O);
    } else {
      result.hasHit = false;
    }
    return result;
  }

  dispose(): void {
    this._nativeWorld?.free();
  }
}
