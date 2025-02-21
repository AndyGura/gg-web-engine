import { CollisionGroup, IPhysicsWorld2dComponent, Point2 } from '@gg-web-engine/core';
import { Engine, World } from 'matter-js';
import { MatterFactory } from '../matter-factory';
import { MatterPhysicsTypeDocRepo } from '../types';
import { Subject } from 'rxjs';
import { MatterRigidBodyComponent } from './matter-rigid-body.component';

// TODO implement bindings for collision groups. Matter.js has elegant solution for that, read body.collisionFilter
export class MatterWorldComponent implements IPhysicsWorld2dComponent<MatterPhysicsTypeDocRepo> {
  protected matterEngine: Engine | null = null;

  public get matterWorld(): World | null {
    return this.matterEngine && this.matterEngine.world;
  }

  public readonly factory: MatterFactory = new MatterFactory();

  public readonly added$: Subject<MatterRigidBodyComponent> = new Subject();
  public readonly removed$: Subject<MatterRigidBodyComponent> = new Subject();
  public readonly children: MatterRigidBodyComponent[] = [];

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
  }

  async init(): Promise<void> {
    this.matterEngine = Engine.create({ gravity: { ...this._gravity, scale: 0.0001 } });
  }

  registerCollisionGroup(): CollisionGroup {
    throw new Error('Collision groups not implemented for Matter.js');
  }

  deregisterCollisionGroup(group: CollisionGroup): void {
    throw new Error('Collision groups not implemented for Matter.js');
  }

  simulate(delta: number): void {
    Engine.update(this.matterEngine!, delta);
  }

  dispose(): void {
    Engine.clear(this.matterEngine!);
  }
}
