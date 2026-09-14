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
} from '@gg-web-engine/core';
import { Collider, EventQueue, init, Vector2, World } from '@dimforge/rapier2d-compat';
import { Rapier2dRigidBodyComponent } from './rapier-2d-rigid-body.component';
import { Rapier2dTriggerComponent } from './rapier-2d-trigger.component';
import { Rapier2dFactory } from '../rapier-2d-factory';
import { Rapier2dPhysicsTypeDocRepo } from '../types';
import { Subject } from 'rxjs';

export class Rapier2dWorldComponent implements IPhysicsWorld2dComponent<Rapier2dPhysicsTypeDocRepo> {
  private _factory: Rapier2dFactory | null = null;
  public get factory(): Rapier2dFactory {
    if (!this._factory) {
      throw new Error('Rapier2d world not initialized');
    }
    return this._factory;
  }

  public readonly added$: Subject<Rapier2dRigidBodyComponent> = new Subject();
  public readonly removed$: Subject<Rapier2dRigidBodyComponent> = new Subject();
  public readonly children: Rapier2dRigidBodyComponent[] = [];

  private readonly unitScale: number = 100; // TODO abstractize somehow, hardcoded now
  private _gravity: Point2 = Pnt2.scalarMult({ x: 0, y: 9.82 }, this.unitScale);
  public get gravity(): Point2 {
    return Pnt2.scalarMult(this._gravity, 1 / this.unitScale);
  }

  public set gravity(value: Point2) {
    this._gravity = Pnt2.scalarMult(value, this.unitScale);
    if (this.nativeWorld) {
      this.nativeWorld.gravity.x = this._gravity.x;
      this.nativeWorld.gravity.y = this._gravity.y;
    }
  }

  readonly mainCollisionGroup: CollisionGroup = 0;

  protected _nativeWorld: World | null = null;
  public get nativeWorld(): World {
    if (!this._nativeWorld) {
      throw new Error('Rapier2d world not initialized');
    }
    return this._nativeWorld;
  }

  private _eventQueue: EventQueue | null = null;
  public get eventQueue(): EventQueue {
    if (!this._eventQueue) {
      throw new Error('Rapier2d world not initialized');
    }
    return this._eventQueue;
  }

  public readonly handleIdEntityMap: Map<number, Rapier2dRigidBodyComponent> = new Map();

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

  simulate(delta: number): void {
    this._nativeWorld!.timestep = delta / 1000;
    this._nativeWorld?.step(this.eventQueue);
    this.dispatchCollisionEvents();
  }

  /**
   * Drains this step's collision events from the world's single shared `EventQueue` and routes
   * each start/stop transition to whichever component(s) it belongs to - a sensor-overlap
   * transition (either side a `Rapier2dTriggerComponent`) goes to that trigger's own
   * `handleOverlapEvent` (its `onEntityEntered`/`onEntityLeft`), a real contact transition between
   * two plain rigid bodies goes to both sides' `handleCollisionStart`/`handleCollisionEnd`
   * (`onCollisionStart`/`onCollisionEnd`).
   *
   * This drains the queue exactly once per `simulate()` call, centrally, rather than leaving each
   * trigger to drain the whole (shared, single) queue itself from its own `checkOverlaps()` - two
   * triggers both calling `drainCollisionEvents` in the same frame would otherwise race for the
   * same queue, with the first drain silently consuming events the second was waiting for (this
   * was already a latent limitation of the pre-existing single-trigger-only draining approach).
   * `Rapier2dTriggerComponent.checkOverlaps()` still exists and is still called by `Trigger2dEntity`
   * every tick, but it no longer drains anything itself - see its own doc.
   */
  private dispatchCollisionEvents(): void {
    if (!this._nativeWorld) {
      return;
    }
    const nativeWorld = this._nativeWorld;
    this.eventQueue.drainCollisionEvents((h1, h2, started) => {
      const collider1 = nativeWorld.colliders.get(h1);
      const collider2 = nativeWorld.colliders.get(h2);
      const body1 = collider1?.parent();
      const body2 = collider2?.parent();
      if (!collider1 || !collider2 || !body1 || !body2) {
        return;
      }
      const c1 = this.handleIdEntityMap.get(body1.handle);
      const c2 = this.handleIdEntityMap.get(body2.handle);
      // `c1 === c2` happens for a compound body's own sub-colliders touching each other (e.g. two
      // parts of the same multi-collider rigid body briefly overlapping) - not a real collision
      // between two bodies, so it must never reach a component's own onCollisionStart/onCollisionEnd
      // stream. Mirrors rapier3d's `dispatchCollisionEvents` guard.
      if (!c1 || !c2 || c1 === c2) {
        return;
      }

      const trigger1 = c1 instanceof Rapier2dTriggerComponent ? c1 : null;
      const trigger2 = c2 instanceof Rapier2dTriggerComponent ? c2 : null;
      if (trigger1 || trigger2) {
        // sensor overlap (at least one side is a trigger) - a trigger has no collision response,
        // so this must never reach the plain-rigid-body onCollisionStart/onCollisionEnd path.
        trigger1?.handleOverlapEvent(c2, started);
        trigger2?.handleOverlapEvent(c1, started);
        return;
      }

      if (started) {
        this.emitCollisionStart(c1, c2, collider1, collider2);
      } else {
        c1.handleCollisionEnd(c2);
        c2.handleCollisionEnd(c1);
      }
    });
  }

  /**
   * Builds and emits the reciprocal `onCollisionStart` pair for two plain rigid-body colliders
   * that Rapier just reported as newly touching.
   *
   * `impulse` is derived from `TempContactManifold.contactImpulse(i)` - the actual per-contact
   * impulse magnitude already solved by Rapier for this step (summed across every contact in the
   * manifold), not an approximation - so it's directly comparable across hits from this adapter.
   * `position` is the first solver contact point (already world-space); `normal` is the manifold's
   * world-space contact normal, oriented for each body so it always points away from that body
   * towards the other (Rapier's `contactPair` may invoke the callback with `flipped: true` when it
   * internally stored the pair as (collider2, collider1) rather than (collider1, collider2), in
   * which case the raw normal already points from collider2 towards collider1 and must be negated
   * to keep a consistent "away from collider1, towards collider2" convention before per-body
   * orientation is applied below).
   *
   * A manifold can legitimately be empty the same step a `started` event is reported for it (the
   * narrow-phase pass that produced the event and the manifold read back here are the same pass,
   * but Rapier doesn't guarantee a manifold survives with contact data intact for every shape pair
   * across that boundary) - in that rare case this falls back to the midpoint between the two
   * bodies' own positions and the direction between them, with `impulse: 0`, rather than dropping
   * the event outright.
   */
  private emitCollisionStart(
    c1: Rapier2dRigidBodyComponent,
    c2: Rapier2dRigidBodyComponent,
    collider1: Collider,
    collider2: Collider,
  ): void {
    let position: Point2 | null = null;
    let normalTowards2: Point2 | null = null;
    let impulse = 0;
    this.nativeWorld.contactPair(collider1, collider2, (manifold, flipped) => {
      const n = manifold.normal();
      normalTowards2 = flipped ? { x: -n.x, y: -n.y } : { x: n.x, y: n.y };
      if (manifold.numSolverContacts() > 0) {
        const p = manifold.solverContactPoint(0);
        if (p) {
          position = { x: p.x, y: p.y };
        }
      }
      for (let i = 0; i < manifold.numContacts(); i++) {
        impulse += manifold.contactImpulse(i);
      }
    });
    if (!position) {
      position = Pnt2.avg(c1.position, c2.position);
    }
    if (!normalTowards2) {
      const dir = Pnt2.sub(c2.position, c1.position);
      normalTowards2 = Pnt2.len(dir) > 1e-9 ? Pnt2.norm(dir) : Pnt2.Y;
    }

    const v1 = c1.linearVelocity;
    const v2 = c2.linearVelocity;

    const event1: CollisionEvent<Point2, Rapier2dRigidBodyComponent> = {
      otherBody: c2,
      position,
      normal: normalTowards2,
      relativeVelocity: Pnt2.sub(v2, v1),
      impulse,
    };
    const event2: CollisionEvent<Point2, Rapier2dRigidBodyComponent> = {
      otherBody: c1,
      position,
      normal: Pnt2.neg(normalTowards2),
      relativeVelocity: Pnt2.sub(v1, v2),
      impulse,
    };
    c1.handleCollisionStart(event1);
    c2.handleCollisionStart(event2);
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
      undefined,
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
      result.hitBody = this.handleIdEntityMap.get(rigidBody.handle);
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
