import {
  BitMask,
  CollisionGroup,
  IPhysicsWorld2dComponent,
  Pnt2,
  Pnt3,
  Point2,
  RaycastOptions,
  RaycastResult,
} from '@gg-web-engine/core';
import { EventQueue, init, Vector2, World } from '@dimforge/rapier2d-compat';
import { Rapier2dRigidBodyComponent } from './rapier-2d-rigid-body.component';
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

  dispose(): void {
    this._nativeWorld?.free();
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
}
