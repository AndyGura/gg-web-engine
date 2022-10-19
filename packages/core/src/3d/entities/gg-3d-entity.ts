import { Subject, Subscription } from 'rxjs';
import { GgPositionable3dEntity } from './gg-positionable-3d-entity';
import { ITickListener } from '../../base/entities/interfaces/i-tick-listener';
import { Point3, Point4 } from '../../base/models/points';
import { IGg3dBody } from '../interfaces/i-gg-3d-body';
import { IGg3dObject } from '../interfaces/i-gg-3d-object';
import { Gg3dWorld } from '../gg-3d-world';

export class Gg3dEntity extends GgPositionable3dEntity implements ITickListener {

  public readonly tick$: Subject<[number, number]> = new Subject<[number, number]>();
  public readonly tickOrder = 750;
  private tickSub: Subscription | null = null;

  set position(value: Point3) {
    if (this.object3D) {
      this.object3D.position = value;
    }
    if (this.objectBody) {
      this.objectBody.position = value;
    }
    super.position = value;
  }

  set rotation(value: Point4) {
    if (this.object3D) {
      this.object3D.rotation = value;
    }
    if (this.objectBody) {
      this.objectBody.rotation = value;
    }
    super.rotation = value;
  }

  set scale(value: Point3) {
    if (this.object3D) {
      this.object3D.scale = value;
    }
    if (this.objectBody) {
      this.objectBody.scale = value;
    }
    super.scale = value;
  }

  constructor(
    public readonly object3D: IGg3dObject | null,
    public readonly objectBody: IGg3dBody | null,
  ) {
    super();
    if (objectBody && object3D) {
      this.tickSub = this.tick$.subscribe(() => {
        // bind physics body transform to mesh transform
        const pos = objectBody.position;
        const quat = objectBody.rotation;
        object3D.position = pos;
        object3D.rotation = quat;
        this._position$.next(pos);
        this._rotation$.next(quat);
      });
    } else if (!objectBody && !object3D) {
      throw new Error('Cannot create entity without a mesh and a body');
    }
  }

  onSpawned(world: Gg3dWorld) {
    super.onSpawned(world);
    this.object3D?.addToWorld(world.visualScene);
    this.objectBody?.addToWorld(world.physicsWorld);
  }

  onRemoved() {
    this.object3D?.removeFromWorld(this.world!.visualScene);
    this.objectBody?.removeFromWorld(this.world!.physicsWorld);
    super.onRemoved();
  }

  dispose(): void {
    this.tickSub?.unsubscribe();
    this.tickSub = null;
    if (this.object3D) {
      this.object3D.dispose();
    }
    if (this.objectBody) {
      this.objectBody.dispose();
    }
  }

}
