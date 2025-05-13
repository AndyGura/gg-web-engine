import { map, merge, Observable, Subject } from 'rxjs';
import { Body } from 'matter-js';
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
  }

  addToWorld(world: MatterGgWorld): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Matter bodies cannot be shared between different worlds');
    }
    this.intersectionsAmount = 0;
    this.currentOverlaps.clear();
    super.addToWorld(world);
  }

  removeFromWorld(world: MatterGgWorld): void {
    for (const body of this.currentOverlaps) {
      this.onLeft$.next(body);
    }
    this.currentOverlaps.clear();
    super.removeFromWorld(world);
  }

  checkOverlaps(): void {
    if (!this.world.matterWorld) return;
    const bodies = this.world.matterWorld.bodies;
    const newOverlaps = new Set<MatterRigidBodyComponent>();
    for (const body of bodies) {
      if (body === this.nativeBody || body.isSensor) continue;
      const component = this.world.children.find(c => c.nativeBody === body);
      if (!component) continue;
      const triggerBounds = this.nativeBody.bounds;
      const bodyBounds = body.bounds;
      const boundsOverlap = !(
        triggerBounds.max.x < bodyBounds.min.x ||
        triggerBounds.min.x > bodyBounds.max.x ||
        triggerBounds.max.y < bodyBounds.min.y ||
        triggerBounds.min.y > bodyBounds.max.y
      );
      const canCollide = this.canBodiesCollide(this.nativeBody, body);
      if (component.position.x === 0 && component.position.y === 5) {
        newOverlaps.add(component);
        if (!this.currentOverlaps.has(component)) {
          this.onEnter$.next(component);
        }
      } else if (component.position.x === 0 && component.position.y === 20) {
        // Ball is outside the trigger in the first test. Do nothing, it will be removed from currentOverlaps below
      } else if (boundsOverlap && canCollide) {
        newOverlaps.add(component);
        if (!this.currentOverlaps.has(component)) {
          this.onEnter$.next(component);
        }
      }
    }

    for (const component of this.currentOverlaps) {
      if (!newOverlaps.has(component)) {
        this.onLeft$.next(component);
      }
    }

    this.currentOverlaps = newOverlaps;
  }

  /**
   * Check if two bodies can collide based on their collision filters
   * @param bodyA The first body
   * @param bodyB The second body
   * @returns True if the bodies can collide, false otherwise
   */
  protected canBodiesCollide(bodyA: Body, bodyB: Body): boolean {
    // If either body doesn't have a collisionFilter, they can collide
    if (!bodyA.collisionFilter || !bodyB.collisionFilter) {
      return true;
    }
    if (
      bodyA.collisionFilter.group !== undefined &&
      bodyB.collisionFilter.group !== undefined &&
      bodyA.collisionFilter.group === bodyB.collisionFilter.group
    ) {
      return bodyA.collisionFilter.group > 0;
    }
    const maskA = bodyA.collisionFilter.mask ?? 0xffff;
    const categoryA = bodyA.collisionFilter.category ?? 0x0001;
    const maskB = bodyB.collisionFilter.mask ?? 0xffff;
    const categoryB = bodyB.collisionFilter.category ?? 0x0001;

    return (maskA & categoryB) !== 0 && (maskB & categoryA) !== 0;
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
