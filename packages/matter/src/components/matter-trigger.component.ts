import { map, merge, Observable, Subject } from 'rxjs';
import { Body, Engine, Events, IEventCollision } from 'matter-js';
import { MatterRigidBodyComponent } from './matter-rigid-body.component';
import { DebugBody2DSettings, ITrigger2dComponent, Shape2DDescriptor } from '@gg-web-engine/core';
import { MatterWorldComponent } from './matter-world.component';
import { MatterGgWorld, MatterPhysicsTypeDocRepo } from '../types';

export class MatterTriggerComponent
  extends MatterRigidBodyComponent
  implements ITrigger2dComponent<MatterPhysicsTypeDocRepo>
{
  get onEntityEntered(): Observable<MatterRigidBodyComponent> {
    return this.onEnter$.asObservable();
  }

  get onEntityLeft(): Observable<MatterRigidBodyComponent> {
    return this.onLeft$.asObservable();
  }

  protected readonly onEnter$: Subject<MatterRigidBodyComponent> = new Subject<MatterRigidBodyComponent>();
  protected readonly onLeft$: Subject<MatterRigidBodyComponent> = new Subject<MatterRigidBodyComponent>();

  readonly debugBodySettings: DebugBody2DSettings = new DebugBody2DSettings(
    { type: 'TRIGGER', activated: () => this.intersectionsAmount > 0 },
    this.shape,
  );

  protected intersectionsAmount = 0;
  protected currentOverlaps: Set<MatterRigidBodyComponent> = new Set();

  private onCollisionStart(event: IEventCollision<Engine>) {
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

  private onCollisionEnd(event: IEventCollision<Engine>) {
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
    this.onCollisionStart = this.onCollisionStart.bind(this);
    this.onCollisionEnd = this.onCollisionEnd.bind(this);
  }

  addToWorld(world: MatterGgWorld): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Matter bodies cannot be shared between different worlds');
    }
    this.intersectionsAmount = 0;
    this.currentOverlaps.clear();
    super.addToWorld(world);

    Events.on(world.physicsWorld.matterEngine!, 'collisionStart', this.onCollisionStart);
    Events.on(world.physicsWorld.matterEngine!, 'collisionEnd', this.onCollisionEnd);
  }

  removeFromWorld(world: MatterGgWorld): void {
    Events.off(world.physicsWorld.matterEngine!, 'collisionStart', this.onCollisionStart);
    Events.off(world.physicsWorld.matterEngine!, 'collisionEnd', this.onCollisionEnd);

    for (const body of this.currentOverlaps) {
      this.onLeft$.next(body);
    }
    this.currentOverlaps.clear();
    super.removeFromWorld(world);
  }

  checkOverlaps(): void {
    // do nothing, for matter.js we handle this differently
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
