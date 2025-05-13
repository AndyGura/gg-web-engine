import { CollisionGroup, IPhysicsWorld2dComponent, Point2 } from '@gg-web-engine/core';
import { Engine, World } from 'matter-js';
import { MatterFactory } from '../matter-factory';
import { MatterPhysicsTypeDocRepo } from '../types';
import { Subject } from 'rxjs';
import { MatterRigidBodyComponent } from './matter-rigid-body.component';
import { MatterTriggerComponent } from './matter-trigger.component';

// TODO probably should be configurable in world
const MATTER_WORLD_SCALE = 0.0001;

export class MatterWorldComponent implements IPhysicsWorld2dComponent<MatterPhysicsTypeDocRepo> {
  protected matterEngine: Engine | null = null;

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
  }

  async init(): Promise<void> {
    this.matterEngine = Engine.create({
      gravity: { ...this._gravity, scale: MATTER_WORLD_SCALE },
    });
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

  dispose(): void {
    Engine.clear(this.matterEngine!);
  }
}
