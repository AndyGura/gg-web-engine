import { map, merge, Observable, Subject } from 'rxjs';
import { Body, Engine, Events, IEventCollision, Query } from 'matter-js';
import { MatterRigidBodyComponent } from './matter-rigid-body.component';
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

  private handleCollisionStart(event: IEventCollision<Engine>) {
    for (const pair of event.pairs) {
      let body: Body | null = null;
      if (pair.bodyA === this.nativeBody) {
        body = pair.bodyB;
      } else if (pair.bodyB === this.nativeBody) {
        body = pair.bodyA;
      }
      if (body) {
        let comp = this.world.children.find(c => c.nativeBody === body);
        if (comp) {
          this.onEnter$.next(comp);
        }
      }
    }
  }

  private handleCollisionEnd(event: IEventCollision<Engine>) {
    for (const pair of event.pairs) {
      let body: Body | null = null;
      if (pair.bodyA === this.nativeBody) {
        body = pair.bodyB;
      } else if (pair.bodyB === this.nativeBody) {
        body = pair.bodyA;
      }
      if (body) {
        let comp = this.world.children.find(c => c.nativeBody === body);
        if (comp) {
          this.onLeft$.next(comp);
        }
      }
    }
  }

  constructor(
    nativeBody: Body,
    public readonly shape: Shape2DDescriptor,
    protected readonly world: MatterWorldComponent,
  ) {
    super(nativeBody, shape);
    this.nativeBody.isSensor = true;
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
      throw new Error('Matter bodies cannot be shared between different worlds');
    }
    this.intersectionsAmount = 0;
    this.currentOverlaps.clear();
    super.addToWorld(world);

    Events.on(world.physicsWorld.matterEngine!, 'collisionStart', this.handleCollisionStart);
    Events.on(world.physicsWorld.matterEngine!, 'collisionEnd', this.handleCollisionEnd);
  }

  removeFromWorld(world: MatterGgWorld, dispose?: boolean): void {
    Events.off(world.physicsWorld.matterEngine!, 'collisionStart', this.handleCollisionStart);
    Events.off(world.physicsWorld.matterEngine!, 'collisionEnd', this.handleCollisionEnd);

    for (const body of this.currentOverlaps) {
      this.onLeft$.next(body);
    }
    this.currentOverlaps.clear();
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
   * Regular rigid-body overlaps are handled entirely by `handleCollisionStart`/`handleCollisionEnd`
   * above, off matter's own native `collisionStart`/`collisionEnd` engine events - so this used to be
   * a pure no-op for matter-js. A `MatterCharacterControllerComponent`'s own phantom body is
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
    // `Query.collides` tests raw geometry only and knows nothing about `collisionFilter` (see
    // `MatterCharacterControllerComponent.collectObstacles`'s own doc on this same gap) - replicate
    // matter's own `Detector.canCollide` category/mask check by hand so a character controller whose
    // collision groups wouldn't ordinarily interact with this trigger isn't falsely reported entering
    // it just because this poll bypasses the broadphase that would otherwise exclude it.
    const canCollideWith = (other: Body): boolean => {
      const a = this.nativeBody.collisionFilter;
      const b = other.collisionFilter;
      const aCategory = a.category ?? 0x0001;
      const aMask = a.mask ?? 0xffffffff;
      const bCategory = b.category ?? 0x0001;
      const bMask = b.mask ?? 0xffffffff;
      return (aMask & bCategory) !== 0 && (bMask & aCategory) !== 0;
    };
    const characters = this.world.children.filter(
      (c): c is MatterCharacterControllerComponent =>
        c instanceof MatterCharacterControllerComponent && canCollideWith(c.nativeBody),
    );
    const stillOverlapping = new Set<MatterCharacterControllerComponent>();
    if (characters.length > 0) {
      const collisions = Query.collides(
        this.nativeBody,
        characters.map(c => c.nativeBody),
      );
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

  clone(): MatterTriggerComponent {
    const clonedBody = Body.create({
      ...this.nativeBody,
      isSensor: true,
      collisionFilter: {
        ...this.nativeBody.collisionFilter,
      },
    });
    const component = new MatterTriggerComponent(clonedBody, this.shape, this.world);
    component.ownCollisionGroups = this.ownCollisionGroups;
    component.interactWithCollisionGroups = this.interactWithCollisionGroups;
    return component;
  }
}
