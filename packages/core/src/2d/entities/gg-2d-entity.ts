import { Subject, Subscription } from 'rxjs';
import { GgPositionable2dEntity } from './gg-positionable-2d-entity';
import { ITickListener } from '../../base/entities/interfaces/i-tick-listener';
import { Point3 } from '../../base/models/points';
import { Gg2dBody } from '../interfaces/gg-2d-body';
import { Gg2dObject } from '../interfaces/gg-2d-object';
import { Gg3dWorld } from '../../3d/gg-3d-world';

export class Gg2dEntity extends GgPositionable2dEntity implements ITickListener {

  public readonly tick$: Subject<[number, number]> = new Subject<[number, number]>();
  public readonly tickOrder = 750;
  private tickSub: Subscription | null = null;

  set position(value: Point3) {
    if (this.object2D) {
      this.object2D.position = value;
    }
    if (this.objectBody) {
      this.objectBody.position = value;
    }
    super.position = value;
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

  set scale(value: Point3) {
    if (this.object2D) {
      this.object2D.scale = value;
    }
    if (this.objectBody) {
      this.objectBody.scale = value;
    }
    super.scale = value;
  }

  constructor(
    public readonly object2D: Gg2dObject | null,
    public readonly objectBody: Gg2dBody | null,
  ) {
    super();
    if (objectBody && object2D) {
      this.tickSub = this.tick$.subscribe(() => {
        // bind physics body transform to object transform
        const pos = objectBody.position;
        const rot = objectBody.rotation;
        object2D.position = pos;
        object2D.rotation = rot;
        this._position$.next(pos);
        this._rotation$.next(rot);
      });
    } else if (!objectBody && !object2D) {
      throw new Error('Cannot create entity without a sprite and a body');
    }
  }

  onSpawned(world: Gg3dWorld) {
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
