import {
  BitMask,
  CollisionGroup,
  IPhysicsWorld2dComponent,
  Pnt2,
  Point2,
  RaycastOptions,
  RaycastResult,
} from '@gg-web-engine/core';
import { Body, Collision, Composite, Engine, Events, IEventCollision, Vector, World } from 'matter-js';
import { MatterFactory } from '../matter-factory';
import { MatterPhysicsTypeDocRepo } from '../types';
import { Subject } from 'rxjs';
import { MatterRigidBodyComponent } from './matter-rigid-body.component';
import { MatterTriggerComponent } from './matter-trigger.component';
import { MatterCharacterControllerComponent } from './matter-character-controller.component';

// bodies that get pushed into `children`/`added$`/`removed$`/`handleIdEntityMap` - see
// MatterWorldComponent's ctor. A character controller's own phantom body is never added to
// `Composite`/`engine.world` (see that class's own doc), so it never participates in
// `handleCollisionStart`/`handleCollisionEnd` below - it's tracked here purely so
// `MatterTriggerComponent.checkOverlaps()` can enumerate the currently-added character controllers
// to poll against, mirroring `children`'s existing role for ordinary rigid bodies/triggers.
type MatterWorldChild = MatterRigidBodyComponent | MatterTriggerComponent | MatterCharacterControllerComponent;

/**
 * Averages matter-js's collision support points into a single representative contact point for
 * `CollisionEvent.position`. `collision.supports` is *always* a fixed-length-2 array
 * (`[null, null]` initially - see `Collision.js`'s `Collision.create`), but `@types/matter-js`
 * 0.20.2 types it as plain `Vector[]` with no way to tell which slots are actually populated -
 * only the first `collision.supportCount` entries are ever real, the rest can be `null` (or stale
 * leftovers from a previous collision reusing the same record). Reading past `supportCount` (or
 * trusting `.length`, always 2) crashes on the `null` slot - always slice to `supportCount` first.
 */
function averageSupports(collision: Collision): Point2 {
  // `supportCount` is real at runtime (see `Collision.js`) but missing from `@types/matter-js`
  // 0.20.2's `Collision` typing entirely - cast narrowly just for this one field.
  const supportCount = (collision as unknown as { supportCount: number }).supportCount;
  const supports = collision.supports.slice(0, supportCount) as Vector[];
  if (supports.length === 0) {
    return Pnt2.O;
  }
  let sum = Pnt2.O;
  for (const support of supports) {
    sum = Pnt2.add(sum, support);
  }
  return Pnt2.scalarMult(sum, 1 / supports.length);
}

/**
 * Standard 2D segment-vs-segment intersection (parametric form): `p1->p2` is the ray segment,
 * `p3->p4` one polygon edge. Returns the intersection's fractional position along `p1->p2`
 * (`t`, always in `[0,1]` when a result is returned) and the world-space point itself, or `null`
 * for parallel/non-intersecting/out-of-range segments. Used by `MatterWorldComponent.raycast`
 * (see its own doc for why) instead of matter-js's own `Query.ray`/`Collision.collides`, which
 * only ever reports an approximate SAT contact point, not a true point where the ray segment
 * crosses a candidate's actual boundary.
 */
function segmentIntersection(p1: Point2, p2: Point2, p3: Point2, p4: Point2): { t: number; point: Point2 } | null {
  const d1 = Pnt2.sub(p2, p1);
  const d2 = Pnt2.sub(p4, p3);
  const denom = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(denom) < 1e-10) {
    return null; // parallel (or degenerate) - no single intersection point
  }
  const diff = Pnt2.sub(p3, p1);
  const t = (diff.x * d2.y - diff.y * d2.x) / denom;
  const u = (diff.x * d1.y - diff.y * d1.x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) {
    return null;
  }
  return { t, point: Pnt2.add(p1, Pnt2.scalarMult(d1, t)) };
}

/**
 * Every polygon (in matter-js's sense) making up `body`'s actual collision boundary, each as a
 * closed loop of world-space vertices - `body` itself for a simple (non-compound) body, or every
 * part but the synthetic index-0 "container" part for a compound one (mirrors `Query.collides`'s
 * own `partsAStart = partsALength === 1 ? 0 : 1` convention). A circle is included via matter-js's
 * own many-sided-polygon approximation (`Bodies.circle` is built on `Bodies.polygon`) - close
 * enough for a raycast headroom check, not a true circle intersection.
 */
function bodyPolygons(body: Body): Vector[][] {
  const parts = body.parts.length === 1 ? [body] : body.parts.slice(1);
  return parts.map(part => part.vertices);
}

// TODO probably should be configurable in world
const MATTER_WORLD_SCALE = 0.0001;

export class MatterWorldComponent implements IPhysicsWorld2dComponent<MatterPhysicsTypeDocRepo> {
  protected matterEngine_: Engine | null = null;

  public get matterEngine(): Engine | null {
    return this.matterEngine_;
  }

  public get matterWorld(): World | null {
    return this.matterEngine && this.matterEngine.world;
  }

  public readonly factory: MatterFactory;

  public readonly added$: Subject<MatterWorldChild> = new Subject();
  public readonly removed$: Subject<MatterWorldChild> = new Subject();
  public readonly children: MatterWorldChild[] = [];

  /** Mirrors the rapier packages' `handleIdEntityMap` pattern: `Body.id` (matter-js's own
   * globally-unique numeric id, assigned once per body via `Body.nextId` and stable for its whole
   * lifetime) to component, kept in sync alongside `children` so `findRigidBody` - called once per
   * collision pair, per step - is an O(1) lookup instead of an O(n) `Array.find` scan. Also used by
   * `MatterCharacterControllerComponent.pushDynamicBodies` to resolve a native body it just bumped
   * into back to its owning component. */
  public readonly handleIdEntityMap: Map<number, MatterWorldChild> = new Map();

  private _gravity: Point2 = { x: 0, y: 9.82 };
  public get gravity(): Point2 {
    return this._gravity;
  }

  public set gravity(value: Point2) {
    this._gravity = value;
    if (this.matterEngine) {
      this.matterEngine.gravity.x = this._gravity.x;
      this.matterEngine.gravity.y = this._gravity.y;
    }
  }

  readonly mainCollisionGroup: CollisionGroup = 0;

  constructor() {
    this.added$.subscribe(c => {
      this.children.push(c);
      this.handleIdEntityMap.set(c.nativeBody.id, c);
    });
    this.removed$.subscribe(c => {
      this.children.splice(this.children.indexOf(c), 1);
      this.handleIdEntityMap.delete(c.nativeBody.id);
    });
    this.factory = new MatterFactory(this);
    this.handleCollisionStart = this.handleCollisionStart.bind(this);
    this.handleCollisionEnd = this.handleCollisionEnd.bind(this);
  }

  async init(): Promise<void> {
    this.matterEngine_ = Engine.create({
      gravity: { ...this._gravity, scale: MATTER_WORLD_SCALE },
    });
    Events.on(this.matterEngine_, 'collisionStart', this.handleCollisionStart);
    Events.on(this.matterEngine_, 'collisionEnd', this.handleCollisionEnd);
  }

  private findRigidBody(nativeBody: Body): MatterRigidBodyComponent | undefined {
    // a character controller's phantom body is never added to `Composite`/`engine.world` (see its
    // own doc), so it can never actually be `pair.bodyA`/`pair.bodyB` here - this narrows the lookup's
    // type back down since `handleIdEntityMap` itself now also tracks that component class.
    const comp = this.handleIdEntityMap.get(nativeBody.id);
    return comp instanceof MatterRigidBodyComponent ? comp : undefined;
  }

  /**
   * Wires `IRigidBody2dComponent.onCollisionStart` for every non-sensor pair in the world, off
   * matter-js's own `Matter.Events` 'collisionStart' (fired once per engine, not per-body - see
   * `gg-engine-physics-adapter-matter` for why it's registered here rather than per component).
   * `pair.isSensor` (true whenever either side is a trigger's underlying body, which always has
   * `isSensor: true` - see `MatterTriggerComponent`'s constructor) is skipped entirely, so a
   * trigger overlapping a rigid body only ever fires the trigger's own `onEntityEntered`, never
   * this.
   *
   * Impulse: at the point this event fires, matter-js hasn't run `Resolver.solveVelocity` yet for
   * this step (that happens later in `Engine.update`, whose event order is
   * collisionStart → position solve → velocity solve → collisionActive → collisionEnd) - so a
   * freshly-created pair's `pair.contacts[*].normalImpulse`/`tangentImpulse` are still their
   * just-initialized `0`, not yet a meaningful number, for every pair this event could ever
   * report. Rather than reading always-zero data, `impulse` here is estimated as
   * `|relativeVelocity| * min(massA, massB)` (a rough "how hard did they hit" proxy - a static
   * body's `mass` is `Infinity`, so `min` naturally reduces to the dynamic side's mass when one
   * side is static).
   */
  private handleCollisionStart(event: IEventCollision<Engine>): void {
    for (const pair of event.pairs) {
      if (pair.isSensor) {
        continue;
      }
      const compA = this.findRigidBody(pair.bodyA);
      const compB = this.findRigidBody(pair.bodyB);
      if (!compA || !compB) {
        continue;
      }
      const position = averageSupports(pair.collision);
      // `pair.collision.normal` is normalized, but - despite `Collision.js`'s own inline comment
      // claiming it's "facing away from bodyA" - empirically (verified against a floor/falling-ball
      // scenario with known relative positions) it always ends up facing the *opposite* way: away
      // from `pair.bodyB`, towards `pair.bodyA`. `Collision.js`'s flip check
      // (`if (normalX * deltaX + normalY * deltaY >= 0) { negate }`, where `delta = bodyB.position -
      // bodyA.position`) guarantees the *final* normal always has a non-positive dot product with
      // the A→B delta - i.e. it points away from B, not away from A as the comment says. So it's
      // `compB`'s event that gets the raw value here, and `compA`'s that needs the negation - the
      // opposite pairing a literal reading of the upstream comment would suggest.
      const normalFromB = Pnt2.clone(pair.collision.normal);
      const normalFromA = Pnt2.neg(normalFromB);
      const relativeVelocityForA = Pnt2.sub(compB.linearVelocity, compA.linearVelocity);
      const relativeVelocityForB = Pnt2.neg(relativeVelocityForA);
      const impulse = Pnt2.len(relativeVelocityForA) * Math.min(compA.nativeBody.mass, compB.nativeBody.mass);
      const baseEvent = { position, impulse };
      compA.notifyCollisionStart({
        ...baseEvent,
        otherBody: compB,
        normal: normalFromA,
        relativeVelocity: relativeVelocityForA,
      });
      compB.notifyCollisionStart({
        ...baseEvent,
        otherBody: compA,
        normal: normalFromB,
        relativeVelocity: relativeVelocityForB,
      });
    }
  }

  /** Wires `IRigidBody2dComponent.onCollisionEnd` for every non-sensor pair that just stopped
   * touching - see `handleCollisionStart`'s doc for why sensor pairs are skipped and why this is
   * registered once per engine rather than per-body. */
  private handleCollisionEnd(event: IEventCollision<Engine>): void {
    for (const pair of event.pairs) {
      if (pair.isSensor) {
        continue;
      }
      const compA = this.findRigidBody(pair.bodyA);
      const compB = this.findRigidBody(pair.bodyB);
      if (!compA || !compB) {
        continue;
      }
      compA.notifyCollisionEnd(compB);
      compB.notifyCollisionEnd(compA);
    }
  }

  protected lockedCollisionGroups: number[] = [];

  registerCollisionGroup(): CollisionGroup {
    for (let i = 1; i < 16; i++) {
      if (!this.lockedCollisionGroups.includes(i)) {
        this.lockedCollisionGroups.push(i);
        return i;
      }
    }
    throw new Error('App tries to register 17th collision group, but Matter.js supports only 16');
  }

  deregisterCollisionGroup(group: CollisionGroup): void {
    this.lockedCollisionGroups = this.lockedCollisionGroups.filter(x => x !== group);
  }

  private lastDelta = 0;

  simulate(delta: number): void {
    Engine.update(this.matterEngine!, delta, this.lastDelta > 0 ? delta / this.lastDelta : 1);
    this.lastDelta = delta;
  }

  /**
   * matter-js has no native raycast query. Built on a true parametric ray-vs-polygon intersection
   * (`segmentIntersection`/`bodyPolygons`), not `Matter.Query.ray` - that helper is only a thin
   * wrapper over `Query.collides` (a full-geometry SAT test of a synthetic, very thin rectangle body
   * against candidates), which reports an approximate overlap contact point, not a true "where does
   * the ray segment first cross this body's boundary" point; verified via this adapter's own
   * regression suite (`MatterWorldComponent.spec.ts`'s `Raycast` block expects a precise hit point at
   * a known box edge) that the SAT-approximated version produces a visibly wrong point.
   *
   * `Query.collides`/`Collision.collides`/matter's own `Detector.canCollide` all test raw geometry
   * only and know nothing about `collisionFilter` (the same limitation
   * `MatterCharacterControllerComponent.collectObstacles`'s own doc describes) - candidates are
   * pre-filtered here by hand, replicating `Detector.canCollide`'s category/mask check plus
   * `options.collisionFilterGroups`/`collisionFilterMask`. Sensor bodies (triggers) are excluded from
   * candidates entirely, mirroring `collectObstacles`'s own exclusion - a trigger never physically
   * blocks anything, so it shouldn't register as a raycast hit either.
   *
   * `hitNormal` is derived from whichever polygon edge the closest intersection landed on (rotated
   * 90°, sign chosen to point back towards `options.from`) - not from a matter-js collision object at
   * all, sidestepping the sign-convention pitfall `handleCollisionStart`'s own doc describes for
   * `pair.collision.normal`.
   */
  raycast(options: RaycastOptions<Point2>): RaycastResult<Point2, MatterRigidBodyComponent> {
    const matterWorld = this.matterWorld;
    const direction = Pnt2.sub(options.to, options.from);
    const rayLength = Pnt2.len(direction);
    if (!matterWorld || rayLength === 0) {
      return { hasHit: false };
    }

    const groupsMask = options.collisionFilterGroups
      ? BitMask.pack(options.collisionFilterGroups, 16)
      : BitMask.full(16);
    const maskMask = options.collisionFilterMask ? BitMask.pack(options.collisionFilterMask, 16) : BitMask.full(16);
    const candidates = Composite.allBodies(matterWorld).filter(b => {
      if (b.isSensor) {
        return false;
      }
      const filter = b.collisionFilter;
      const category = filter.category ?? 0x0001;
      const mask = filter.mask ?? 0xffffffff;
      return (groupsMask & mask) !== 0 && (category & maskMask) !== 0;
    });

    let closestT = Infinity;
    let closestPoint: Point2 | null = null;
    let closestNormal: Point2 | null = null;
    let closestBody: Body | null = null;
    for (const body of candidates) {
      for (const polygon of bodyPolygons(body)) {
        for (let i = 0; i < polygon.length; i++) {
          const a = polygon[i];
          const b = polygon[(i + 1) % polygon.length];
          const hit = segmentIntersection(options.from, options.to, a, b);
          if (!hit || hit.t >= closestT) {
            continue;
          }
          closestT = hit.t;
          closestPoint = hit.point;
          closestBody = body;
          const edge = Pnt2.sub(b, a);
          const normal = Pnt2.norm({ x: -edge.y, y: edge.x });
          closestNormal = Pnt2.dot(normal, Pnt2.sub(options.from, hit.point)) >= 0 ? normal : Pnt2.neg(normal);
        }
      }
    }
    if (!closestBody) {
      return { hasHit: false };
    }

    // A compound body's hit part is not the parent body `handleIdEntityMap` is keyed by (see
    // `MatterFactory`'s compound-shape flattening) - `.parent` (self-referential for a non-compound
    // body) resolves back to it.
    const parentBody = closestBody.parent ?? closestBody;
    const resolved = this.handleIdEntityMap.get(parentBody.id);
    return {
      hasHit: true,
      hitBody: resolved instanceof MatterRigidBodyComponent ? resolved : undefined,
      hitDistance: closestT * rayLength,
      hitPoint: closestPoint!,
      hitNormal: closestNormal!,
    };
  }

  dispose(): void {
    Events.off(this.matterEngine!, 'collisionStart', this.handleCollisionStart);
    Events.off(this.matterEngine!, 'collisionEnd', this.handleCollisionEnd);
    Engine.clear(this.matterEngine!);
  }
}
