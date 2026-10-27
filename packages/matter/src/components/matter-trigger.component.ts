import { map, merge, Observable, Subject, Subscription } from 'rxjs';
import { Body, Collision, Detector, Engine, Events, IEventCollision, Pair, Query } from 'matter-js';
import { MatterRigidBodyComponent } from './matter-rigid-body.component';
import { buildMatterTriggerBody } from '../matter-rigid-body-builder';
import { MatterCharacterControllerComponent } from './matter-character-controller.component';
import { DebugBody2DSettings, ITrigger2dComponent, Shape2DDescriptor } from '@gg-web-engine/core';
import { MatterWorldComponent } from './matter-world.component';
import { MatterGgWorld, MatterPhysicsTypeDocRepo } from '../types';

export class MatterTriggerComponent
  extends MatterRigidBodyComponent
  implements ITrigger2dComponent<MatterPhysicsTypeDocRepo>
{
  get onEntityEntered(): Observable<MatterRigidBodyComponent | MatterCharacterControllerComponent> {
    return this.onEnter$.asObservable();
  }

  get onEntityLeft(): Observable<MatterRigidBodyComponent | MatterCharacterControllerComponent> {
    return this.onLeft$.asObservable();
  }

  protected readonly onEnter$: Subject<MatterRigidBodyComponent | MatterCharacterControllerComponent> = new Subject();
  protected readonly onLeft$: Subject<MatterRigidBodyComponent | MatterCharacterControllerComponent> = new Subject();

  /** Character controllers currently overlapping this trigger, as of the last `checkOverlaps()`
   * poll - see that method's own doc for why this needs its own separate polling mechanism instead
   * of the native `collisionStart`/`collisionEnd` events `handleCollisionStart`/`handleCollisionEnd`
   * below rely on for ordinary rigid bodies. */
  protected currentCharacterOverlaps: Set<MatterCharacterControllerComponent> = new Set();

  readonly debugBodySettings: DebugBody2DSettings = new DebugBody2DSettings(
    { type: 'TRIGGER', activated: () => this.intersectionsAmount > 0 },
    this.shape,
  );

  protected intersectionsAmount = 0;
  protected currentOverlaps: Set<MatterRigidBodyComponent> = new Set();
  /** The subset of `currentOverlaps` whose exit `checkOverlaps()` detects by polling, because matter's
   * detector doesn't pair them with this (static) trigger body - see {@link isPolled}. A body moves
   * back to the native-event path once a native `collisionStart` reports it (it woke up inside). */
  protected polledOverlaps: Set<MatterRigidBodyComponent> = new Set();

  /** `Composite.remove` (what `removeFromWorld` calls) reports nothing at the moment of removal: a
   * removed body's pairs stay in `engine.pairs` until the next `Engine.update` ends them, and a
   * character controller's phantom body has no native pairs at all. This reaction is what reports
   * a body removed while still overlapping this trigger: it drops it from `currentOverlaps` (or
   * `currentCharacterOverlaps`) and `nativePairCounts`, purges its pairs with this trigger when it
   * had an active one (see {@link purgeNativePairs}, so a body re-added before the next update gets
   * a fresh `collisionStart`), and emits `onEntityLeft`. `world.physicsWorld.removed$` fires for every
   * component removal regardless of overlap state, so this only emits for a component this trigger
   * was still tracking as an overlap.
   *
   * The stale entry is dropped synchronously, but `onLeft$` itself is only ever emitted on a
   * microtask from this reaction, never inline. `removed$` fires from inside whatever call stack
   * performed the removal - which can be another component's own in-progress lifecycle operation:
   * `CharacterController2dEntity.recreateCapsule()` (crouch/stand) removes the *old*
   * `characterController` with `dispose: true` before it has assigned the new one, so an `onLeft$`
   * subscriber running inline there (app code driven by `Trigger2dEntity`, e.g. a kill volume
   * resetting `.position` on the character that just left it) would write through the old,
   * already-removed `MatterCharacterControllerComponent` - `Body.setPosition` on a body no longer
   * queried by anything - and the write is silently lost, with the replacement capsule then spawning
   * at the stale position. Deferring the emission keeps it within the same JS turn (well before the
   * next `Engine.update`) but strictly after every synchronous call stack in flight, including the
   * removal's own, has unwound. */
  private removedSub?: Subscription;

  /**
   * Native part pairs currently active between this trigger and each awake dynamic body. matter-js
   * pairs *parts*, not bodies: the detector walks parts `1..n` of a multi-part (`COMPOUND`) body, so
   * every `pair.bodyA`/`pair.bodyB` is a part (a single-part body is its own part) and one body pair
   * can be several part pairs at once - a compound body with two parts inside, or a body crossing
   * the seam between two parts of a compound trigger. `onEnter$` fires when a body's count goes
   * 0 -> 1 and `onLeft$` when it returns to 0, so each body enters and leaves once.
   */
  protected readonly nativePairCounts: Map<MatterRigidBodyComponent, number> = new Map();

  /** The rigid-body component on the other side of a native pair that involves this trigger, if any.
   * Both sides are resolved through `.parent` (self-referential for a single-part body) first. */
  private resolveOther(pair: Pair): MatterRigidBodyComponent | null {
    const parentA = pair.bodyA.parent;
    const parentB = pair.bodyB.parent;
    const other = parentA === this.nativeBody ? parentB : parentB === this.nativeBody ? parentA : null;
    if (!other) {
      return null;
    }
    const comp = this.world.handleIdEntityMap.get(other.id);
    return comp instanceof MatterRigidBodyComponent ? comp : null;
  }

  private handleCollisionStart(event: IEventCollision<Engine>) {
    for (const pair of event.pairs) {
      const comp = this.resolveOther(pair);
      if (!comp) {
        continue;
      }
      const count = (this.nativePairCounts.get(comp) || 0) + 1;
      this.nativePairCounts.set(comp, count);
      if (count > 1) {
        continue;
      }
      if (this.currentOverlaps.has(comp)) {
        // already inside via polling (it was asleep or kinematic): the native pair takes over
        this.polledOverlaps.delete(comp);
        continue;
      }
      this.currentOverlaps.add(comp);
      this.onEnter$.next(comp);
    }
  }

  private handleCollisionEnd(event: IEventCollision<Engine>) {
    for (const pair of event.pairs) {
      const comp = this.resolveOther(pair);
      const count = comp && this.nativePairCounts.get(comp);
      if (!comp || !count) {
        continue;
      }
      if (count > 1) {
        this.nativePairCounts.set(comp, count - 1);
        continue;
      }
      this.nativePairCounts.delete(comp);
      if (!this.currentOverlaps.has(comp)) {
        continue;
      }
      if (this.isPolled(comp) && this.overlaps(comp)) {
        // a body falling asleep inside: matter drops the pair without it having left
        this.polledOverlaps.add(comp);
        continue;
      }
      this.currentOverlaps.delete(comp);
      this.polledOverlaps.delete(comp);
      this.onLeft$.next(comp);
    }
  }

  /**
   * Drops the engine's pairs between this trigger and `other` (every pair of this trigger when
   * omitted). `Composite.remove` leaves a removed body's pairs in `engine.pairs`: they only end
   * (with a native `collisionEnd`) on the next `Engine.update`, and a body re-added before that
   * update finds its old pairs still active, so no `collisionStart` would ever report it entering
   * again. Purged pairs are rebuilt from scratch, with a fresh `collisionStart`, by the next update
   * that detects the overlap.
   */
  private purgeNativePairs(other?: Body): void {
    const pairs = this.world.matterEngine?.pairs as { table: Record<string, Pair>; list: Pair[] } | undefined;
    if (!pairs) {
      return;
    }
    // compacted in place, as matter's own `Pairs.update` does
    const list = pairs.list;
    let kept = 0;
    for (let i = 0; i < list.length; i++) {
      const pair = list[i];
      const parentA = pair.bodyA.parent;
      const parentB = pair.bodyB.parent;
      const involvesThis = parentA === this.nativeBody || parentB === this.nativeBody;
      if (involvesThis && (!other || parentA === other || parentB === other)) {
        delete pairs.table[pair.id];
      } else {
        list[kept++] = pair;
      }
    }
    list.length = kept;
  }

  /**
   * Whether matter's detector never pairs `comp` with this trigger: it skips every pair whose bodies
   * are both static or sleeping, and the trigger body is static. That covers sleeping bodies and
   * kinematic ones (built as static here, see `MatterFactory`). Bodies requested as `'static'` are
   * level geometry and are never reported.
   */
  protected isPolled(comp: MatterRigidBodyComponent): boolean {
    return comp.bodyType === 'kinematic_pos' || comp.bodyType === 'kinematic_vel' || comp.nativeBody.isSleeping;
  }

  protected overlaps(comp: MatterRigidBodyComponent): boolean {
    return this.queryCollides([comp.nativeBody]).length > 0;
  }

  /**
   * `Query.collides` against each of this trigger's own parts. Passing a multi-part (`COMPOUND`)
   * body itself as `Query.collides`'s first argument tests the parent's vertices, which are the
   * convex hull of every part - an L-shaped trigger would report a body sitting in its notch. The
   * returned collisions' `parentA`/`parentB` still resolve to this trigger's own body.
   */
  protected queryCollides(bodies: Body[]): Collision[] {
    const parts = this.nativeBody.parts;
    if (parts.length === 1) {
      return Query.collides(this.nativeBody, bodies);
    }
    const collisions: Collision[] = [];
    for (let i = 1; i < parts.length; i++) {
      collisions.push(...Query.collides(parts[i], bodies));
    }
    return collisions;
  }

  constructor(
    nativeBody: Body,
    public readonly shape: Shape2DDescriptor,
    protected readonly world: MatterWorldComponent,
  ) {
    super(nativeBody, shape);
    this.nativeBody.isSensor = true;
    // A trigger is a fixed volume: left non-static, matter-js integrates its sensor body under
    // gravity like any dynamic body, and since a sensor never collides it falls through the level
    // (overlapping, and reporting, whatever it passes on the way down). Static also keeps
    // static-static pairs (trigger vs level geometry) out of matter's broadphase entirely - which
    // drops kinematic and sleeping bodies too, so `checkOverlaps()` polls those.
    Body.setStatic(this.nativeBody, true);
    merge(this.onEnter$.pipe(map(() => true)), this.onLeft$.pipe(map(() => false))).subscribe(enter => {
      if (enter) {
        this.intersectionsAmount++;
      } else {
        this.intersectionsAmount--;
      }
    });
    this.handleCollisionStart = this.handleCollisionStart.bind(this);
    this.handleCollisionEnd = this.handleCollisionEnd.bind(this);
  }

  addToWorld(world: MatterGgWorld): void {
    if (world.physicsWorld != this.world) {
      throw new Error(
        "Matter bodies cannot be shared between different worlds: this one was created by another world's factory. " +
          'Create it with the factory of the world it is added to (`world.physicsWorld.factory`).',
      );
    }
    this.intersectionsAmount = 0;
    this.currentOverlaps.clear();
    this.polledOverlaps.clear();
    this.nativePairCounts.clear();
    super.addToWorld(world);

    Events.on(world.physicsWorld.matterEngine!, 'collisionStart', this.handleCollisionStart);
    Events.on(world.physicsWorld.matterEngine!, 'collisionEnd', this.handleCollisionEnd);
    this.removedSub = world.physicsWorld.removed$.subscribe(c => {
      if (c === this) {
        return;
      }
      if (c instanceof MatterCharacterControllerComponent) {
        if (this.currentCharacterOverlaps.delete(c)) {
          queueMicrotask(() => this.onLeft$.next(c));
        }
      } else if (c instanceof MatterRigidBodyComponent) {
        // an active pair with this trigger was counted on its `collisionStart`; an inactive one
        // reports a fresh `collisionStart` when it activates again, so needs no purge
        if (this.nativePairCounts.delete(c)) {
          this.purgeNativePairs(c.nativeBody);
        }
        if (this.currentOverlaps.delete(c)) {
          this.polledOverlaps.delete(c);
          queueMicrotask(() => this.onLeft$.next(c));
        }
      }
    });
  }

  removeFromWorld(world: MatterGgWorld, dispose?: boolean): void {
    Events.off(world.physicsWorld.matterEngine!, 'collisionStart', this.handleCollisionStart);
    Events.off(world.physicsWorld.matterEngine!, 'collisionEnd', this.handleCollisionEnd);
    this.removedSub?.unsubscribe();

    for (const body of this.currentOverlaps) {
      this.onLeft$.next(body);
    }
    this.currentOverlaps.clear();
    this.polledOverlaps.clear();
    this.nativePairCounts.clear();
    this.purgeNativePairs();
    for (const character of this.currentCharacterOverlaps) {
      this.onLeft$.next(character);
    }
    this.currentCharacterOverlaps.clear();
    super.removeFromWorld(world, dispose);
  }

  /** Completes `onEnter$`/`onLeft$` on top of `MatterRigidBodyComponent.dispose()`'s own
   * `onCollisionStart$`/`onCollisionEnd$` completion (via `super.dispose()`) - this trigger's own
   * enter/exit subjects are a separate pair this subclass owns and must complete itself. */
  dispose(): void {
    this.onEnter$.complete();
    this.onLeft$.complete();
    super.dispose();
  }

  /**
   * Awake dynamic bodies are handled by `handleCollisionStart`/`handleCollisionEnd` above, off
   * matter's own native `collisionStart`/`collisionEnd` engine events; kinematic and sleeping ones,
   * which matter never pairs with this static body, are polled by `checkPolledBodyOverlaps()`.
   * A `MatterCharacterControllerComponent`'s own phantom body is
   * deliberately never added to `Composite`/`engine.world` at all (see that class's own doc), so no
   * native collision pair - and thus no native event - can ever involve it. Since `checkOverlaps()` is
   * already called once per tick by `Trigger2dEntity` regardless of backend, this is the natural place
   * to add the poll this needs instead of inventing a second, differently-shaped mechanism: every
   * `MatterCharacterControllerComponent` currently in the world (`world.children`, which - unlike
   * matter's own `Composite` - already tracks it) is tested against this trigger's own body via
   * `Query.collides`, diffed against `currentCharacterOverlaps` to fire `onEntityEntered`/
   * `onEntityLeft` exactly on the enter/exit transitions, the same as the native-event path does for
   * ordinary bodies.
   */
  checkOverlaps(): void {
    this.checkPolledBodyOverlaps();
    // `Query.collides` tests raw geometry only and knows nothing about `collisionFilter` (see
    // `MatterCharacterControllerComponent.collectObstacles`'s own doc on this same gap) - call
    // matter's own `Detector.canCollide` directly so a character controller whose collision groups
    // wouldn't ordinarily interact with this trigger isn't falsely reported entering it just because
    // this poll bypasses the broadphase that would otherwise exclude it.
    const characters = this.world.children.filter(
      (c): c is MatterCharacterControllerComponent =>
        c instanceof MatterCharacterControllerComponent &&
        Detector.canCollide(this.nativeBody.collisionFilter, c.nativeBody.collisionFilter),
    );
    const stillOverlapping = new Set<MatterCharacterControllerComponent>();
    if (characters.length > 0) {
      const collisions = this.queryCollides(characters.map(c => c.nativeBody));
      for (const collision of collisions) {
        const otherNative = collision.parentA === this.nativeBody ? collision.parentB : collision.parentA;
        const comp = characters.find(c => c.nativeBody === otherNative);
        if (comp) {
          stillOverlapping.add(comp);
        }
      }
    }
    for (const comp of stillOverlapping) {
      if (!this.currentCharacterOverlaps.has(comp)) {
        this.currentCharacterOverlaps.add(comp);
        this.onEnter$.next(comp);
      }
    }
    for (const comp of this.currentCharacterOverlaps) {
      if (!stillOverlapping.has(comp)) {
        this.currentCharacterOverlaps.delete(comp);
        this.onLeft$.next(comp);
      }
    }
  }

  /**
   * Enter/exit of the rigid bodies matter's detector never pairs with this trigger (see
   * {@link isPolled}): a kinematic platform moving in or out, a body asleep inside. Like the
   * character poll below, `Query.collides` ignores `collisionFilter`, so `Detector.canCollide` is
   * checked by hand.
   */
  protected checkPolledBodyOverlaps(): void {
    for (const comp of this.world.children) {
      if (
        comp instanceof MatterRigidBodyComponent &&
        !(comp instanceof MatterTriggerComponent) &&
        !this.currentOverlaps.has(comp) &&
        this.isPolled(comp) &&
        Detector.canCollide(this.nativeBody.collisionFilter, comp.nativeBody.collisionFilter) &&
        this.overlaps(comp)
      ) {
        this.currentOverlaps.add(comp);
        this.polledOverlaps.add(comp);
        this.onEnter$.next(comp);
      }
    }
    for (const comp of this.polledOverlaps) {
      if (!this.overlaps(comp)) {
        this.polledOverlaps.delete(comp);
        this.currentOverlaps.delete(comp);
        this.nativePairCounts.delete(comp);
        this.onLeft$.next(comp);
      }
    }
  }

  clone(): MatterTriggerComponent {
    // rebuilt from the shape, for the same reason as in `MatterRigidBodyComponent.clone()`
    const clonedBody = buildMatterTriggerBody(this.shape, { position: this.position, rotation: this.rotation });
    const component = new MatterTriggerComponent(clonedBody, this.shape, this.world);
    component.ownCollisionGroups = this.ownCollisionGroups;
    component.interactWithCollisionGroups = this.interactWithCollisionGroups;
    return component;
  }
}
