import { Subject } from 'rxjs';
import { GgPositionable3dEntity } from './gg-positionable-3d-entity';
import { GGTickOrder, ITickListener } from '../../base/entities/interfaces/i-tick-listener';
import { Point3, Point4 } from '../../base/models/points';
import { Gg3dWorld } from '../gg-3d-world';
import { IGg3dBody, IGg3dObject } from '../interfaces';

export class Gg3dEntity extends GgPositionable3dEntity implements ITickListener {
  public readonly tick$: Subject<[number, number]> = new Subject<[number, number]>();
  public readonly tickOrder = GGTickOrder.OBJECTS_BINDING;

  public get position(): Point3 {
    return super.position;
  }

  set position(value: Point3) {
    if (this.object3D) {
      this.object3D.position = value;
    }
    if (this.objectBody) {
      this.objectBody.position = value;
    }
    super.position = value;
  }

  public get rotation(): Point4 {
    return super.rotation;
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

  public get scale(): Point3 {
    return super.scale;
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

  public get visible(): boolean {
    return !!this.object3D?.visible;
  }

  set visible(value: boolean) {
    if (this.object3D) {
      this.object3D.visible = value;
    }
    for (const entity of this._children) {
      if (entity instanceof Gg3dEntity) {
        entity.visible = value;
      }
    }
  }

  /**
   * Synchronize physics body transform with entity (and mesh if defined)
   * */
  protected runTransformBinding(objectBody: IGg3dBody, object3D: IGg3dObject | null): void {
    const pos = objectBody.position;
    const quat = objectBody.rotation;
    if (object3D) {
      object3D.position = pos;
      object3D.rotation = quat;
    }
    this._position$.next(pos);
    this._rotation$.next(quat);
  }

  constructor(public readonly object3D: IGg3dObject | null, public readonly objectBody: IGg3dBody | null = null) {
    super();
    if (objectBody) {
      objectBody.entity = this;
      this.tick$.subscribe(() => {
        this.runTransformBinding(objectBody, object3D);
      });
      this.runTransformBinding(objectBody, object3D);
      this.name = objectBody.name;
    } else if (object3D) {
      super.position = object3D.position;
      super.rotation = object3D.rotation;
      super.scale = object3D.scale;
      this.name = object3D.name;
    } else {
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
    super.dispose();
    this.tick$.unsubscribe();
    if (this.object3D) {
      this.object3D.dispose();
    }
    if (this.objectBody) {
      this.objectBody.dispose();
    }
  }
}
