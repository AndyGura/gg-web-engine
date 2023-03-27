import { Subject, Subscription } from 'rxjs';
import { GgPositionable2dEntity } from './gg-positionable-2d-entity';
import { ITickListener } from '../../base/entities/interfaces/i-tick-listener';
import { Point2 } from '../../base/models/points';
import { IGg2dBody, IGg2dObject } from '../interfaces';
import { Gg2dWorld } from '../gg-2d-world';

export class Gg2dEntity extends GgPositionable2dEntity implements ITickListener {
  public readonly tick$: Subject<[number, number]> = new Subject<[number, number]>();
  public readonly tickOrder = 750;
  private tickSub: Subscription | null = null;

  public get position(): Point2 {
    return super.position;
  }

  set position(value: Point2) {
    if (this.object2D) {
      this.object2D.position = value;
    }
    if (this.objectBody) {
      this.objectBody.position = value;
    }
    super.position = value;
  }

  public get rotation(): number {
    return super.rotation;
  }

  set rotation(value: number) {
    if (this.object2D) {
      this.object2D.rotation = value;
    }
    if (this.objectBody) {
      this.objectBody.rotation = value;
    }
    super.rotation = value;
  }

  public get scale(): Point2 {
    return super.scale;
  }

  set scale(value: Point2) {
    if (this.object2D) {
      this.object2D.scale = value;
    }
    if (this.objectBody) {
      this.objectBody.scale = value;
    }
    super.scale = value;
  }

  /**
   * Synchronize physics body transform with entity (and object2d if defined)
   * */
  protected runTransformBinding(objectBody: IGg2dBody, object2D: IGg2dObject | null): void {
    const pos = objectBody.position;
    const quat = objectBody.rotation;
    if (object2D) {
      object2D.position = pos;
      object2D.rotation = quat;
    }
    this._position$.next(pos);
    this._rotation$.next(quat);
  }

  constructor(public readonly object2D: IGg2dObject | null, public readonly objectBody: IGg2dBody | null) {
    super();
    if (objectBody) {
      objectBody.entity = this;
      this.tick$.subscribe(() => {
        this.runTransformBinding(objectBody, object2D);
      });
      this.runTransformBinding(objectBody, object2D);
      this.name = objectBody.name;
    } else if (object2D) {
      this.position = object2D.position;
      this.rotation = object2D.rotation;
      this.scale = object2D.scale;
      this.name = object2D.name;
    } else {
      throw new Error('Cannot create entity without an object2D and a body');
    }
  }

  onSpawned(world: Gg2dWorld) {
    super.onSpawned(world);
    this.object2D?.addToWorld(world.visualScene);
    this.objectBody?.addToWorld(world.physicsWorld);
  }

  onRemoved() {
    this.object2D?.removeFromWorld(this.world!.visualScene);
    this.objectBody?.removeFromWorld(this.world!.physicsWorld);
    super.onRemoved();
  }

  dispose(): void {
    super.dispose();
    this.tickSub?.unsubscribe();
    this.tickSub = null;
    if (this.object2D) {
      this.object2D.dispose();
    }
    if (this.objectBody) {
      this.objectBody.dispose();
    }
  }
}
