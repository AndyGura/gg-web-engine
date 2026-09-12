import {
  CollisionGroup,
  IPhysicsWorld2dComponent,
  Pnt2,
  Point2,
  RaycastOptions,
  RaycastResult,
} from '@gg-web-engine/core';
import { Body, Collision, Engine, Events, IEventCollision, Vector, World } from 'matter-js';
import { MatterFactory } from '../matter-factory';
import { MatterPhysicsTypeDocRepo } from '../types';
import { Subject } from 'rxjs';
import { MatterRigidBodyComponent } from './matter-rigid-body.component';
import { MatterTriggerComponent } from './matter-trigger.component';

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

  public readonly added$: Subject<MatterRigidBodyComponent | MatterTriggerComponent> = new Subject();
  public readonly removed$: Subject<MatterRigidBodyComponent | MatterTriggerComponent> = new Subject();
  public readonly children: (MatterRigidBodyComponent | MatterTriggerComponent)[] = [];

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
    this.added$.subscribe(c => this.children.push(c));
    this.removed$.subscribe(c => this.children.splice(this.children.indexOf(c), 1));
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
    return this.children.find(c => c.nativeBody === nativeBody);
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

  raycast(options: RaycastOptions<Point2>): RaycastResult<Point2, MatterRigidBodyComponent> {
    throw new Error('Ray casting is not implemented for Matter.js');
  }

  dispose(): void {
    Events.off(this.matterEngine!, 'collisionStart', this.handleCollisionStart);
    Events.off(this.matterEngine!, 'collisionEnd', this.handleCollisionEnd);
    Engine.clear(this.matterEngine!);
  }
}
