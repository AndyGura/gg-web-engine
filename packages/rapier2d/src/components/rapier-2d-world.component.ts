import { CollisionGroup, IPhysicsWorld2dComponent, Pnt2, Point2 } from '@gg-web-engine/core';
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
}
