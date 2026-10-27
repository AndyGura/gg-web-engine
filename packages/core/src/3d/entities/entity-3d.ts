import { EMPTY, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  IEntity,
  INetworkSyncable,
  CorrectionOutcome,
  NetworkApplyContext,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  quantizeNetPosition,
  quantizeNetRotation,
  RigidBodyCorrection,
  RigidBodyNetState,
  TickOrder,
} from '../../base';
import { IRigidBody3dComponent } from '../components/physics/i-rigid-body-3d.component';
import { IDisplayObject3dComponent } from '../components/rendering/i-display-object-3d.component';
import { IPositionable3d } from '../interfaces/i-positionable-3d';
import { IRenderable3dEntity } from './i-renderable-3d.entity';
import { networkFrameOf } from '../network-frame';
import { Gg3dWorldTypeDocPPatch, Gg3dWorldTypeDocRepo, PhysicsTypeDocRepo3D } from '../gg-3d-world';
import { Frame3d } from '../models/frame-3d';
import { IFrameSwitchable, switchBodyFrame, switchPoseFrame } from '../interfaces/i-frame-switchable';

export class Entity3d<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo>
  extends IRenderable3dEntity<TypeDoc>
  implements IPositionable3d, INetworkSyncable<RigidBodyNetState<Point3, Point4>>, IFrameSwitchable
{
  static readonly entityTypeName: string = 'Entity3d';
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;

  /**
   * Fires each time this entity's body begins touching another rigid body it wasn't already
   * touching - see `IRigidBodyComponent.onCollisionStart`. `entity` is the other body's owning
   * entity, if it has one (same convention `Trigger3dEntity.onEntityEntered` uses). Entities with
   * no physics body (`objectBody` unset) never emit.
   */
  get onCollisionStart(): Observable<{
    entity:
      (IEntity<Point3, Point4, Gg3dWorldTypeDocRepo & { pTypeDoc: TypeDoc['pTypeDoc'] }> & IPositionable3d) | null;
    otherBody: TypeDoc['pTypeDoc']['rigidBody'];
    position: Point3;
    normal: Point3;
    relativeVelocity: Point3;
    impulse: number;
  }> {
    if (!this.objectBody) {
      return EMPTY;
    }
    return this.objectBody.onCollisionStart.pipe(
      map(evt => ({
        ...evt,
        entity: (evt.otherBody.entity ?? null) as
          (IEntity<Point3, Point4, Gg3dWorldTypeDocPPatch<PhysicsTypeDocRepo3D>> & IPositionable3d) | null,
      })),
    );
  }

  /**
   * Fires each time this entity's body stops touching a rigid body it was previously touching -
   * see `IRigidBodyComponent.onCollisionEnd`. `null` when the other body was removed from the
   * world while still in contact, or when it (or its entity) can't be resolved.
   */
  get onCollisionEnd(): Observable<
    (IEntity<Point3, Point4, Gg3dWorldTypeDocRepo & { pTypeDoc: TypeDoc['pTypeDoc'] }> & IPositionable3d) | null
  > {
    if (!this.objectBody) {
      return EMPTY;
    }
    return this.objectBody.onCollisionEnd.pipe(
      map(
        otherBody =>
          (otherBody?.entity ?? null) as
            (IEntity<Point3, Point4, Gg3dWorldTypeDocPPatch<PhysicsTypeDocRepo3D>> & IPositionable3d) | null,
      ),
    );
  }

  private _position = Pnt3.O;
  public get position(): Point3 {
    return this._position;
  }

  set position(value: Point3) {
    if (this.object3D) {
      this.object3D.position = value;
    }
    if (this.objectBody) {
      this.objectBody.position = value;
    }
    this._position = value;
  }

  private _rotation = Qtrn.O;
  public get rotation(): Point4 {
    return this._rotation;
  }

  set rotation(value: Point4) {
    if (this.object3D) {
      this.object3D.rotation = value;
    }
    if (this.objectBody) {
      this.objectBody.rotation = value;
    }
    this._rotation = value;
  }

  public readonly object3D: TypeDoc['vTypeDoc']['displayObject'] | null = null;
  public readonly objectBody: TypeDoc['pTypeDoc']['rigidBody'] | null = null;

  public updateVisibility(): void {
    if (this.object3D) {
      this.object3D.visible = this.worldVisible;
    }
    super.updateVisibility();
  }

  /**
   * Synchronize physics body transform with entity (and mesh if defined)
   * */
  protected runTransformBinding(objectBody: IRigidBody3dComponent, object3D: IDisplayObject3dComponent | null): void {
    const pos = objectBody.position;
    const quat = objectBody.rotation;
    if (object3D) {
      object3D.position = pos;
      object3D.rotation = quat;
    }
    this._position = pos;
    this._rotation = quat;
  }

  constructor(options: {
    object3D?: TypeDoc['vTypeDoc']['displayObject'] | null;
    objectBody?: TypeDoc['pTypeDoc']['rigidBody'] | null;
  }) {
    super();
    if (options.objectBody) {
      this.objectBody = options.objectBody;
      if (this.objectBody.name) {
        this.name = this.objectBody.name;
      }
      this.addComponents(this.objectBody);
    }
    if (options.object3D) {
      this.object3D = options.object3D;
      if (!options.objectBody) {
        this._position = this.object3D.position;
        this._rotation = this.object3D.rotation;
        if (this.object3D.name) {
          this.name = this.object3D.name;
        }
      }
      this.addComponents(this.object3D);
    }
    if (this.objectBody) {
      this.tick$.subscribe(() => {
        this.runTransformBinding(this.objectBody!, this.object3D);
      });
      this.runTransformBinding(this.objectBody, this.object3D);
    }
  }

  /**
   * `IFrameSwitchable`: moves the body by `delta` (pose and velocities, through the component's own
   * `onFrameSwitch` when the physics adapter has one - see `IRigidBody3dComponent.onFrameSwitch`)
   * and binds the display object to it; without a body, moves the display object.
   */
  public onFrameSwitch(delta: Frame3d): void {
    if (this.objectBody) {
      switchBodyFrame(this.objectBody, delta);
      this.runTransformBinding(this.objectBody, this.object3D);
    } else if (this.object3D) {
      switchPoseFrame(this.object3D, delta);
      this._position = this.object3D.position;
      this._rotation = this.object3D.rotation;
    } else {
      this._position = delta.toGlobalPoint(this._position);
      this._rotation = delta.toGlobalRotation(this._rotation);
    }
  }

  /**
   * `INetworkSyncable`: only an entity with a non-static rigid body takes part in networking - a
   * purely visual entity, or a static body that never moves, has nothing to synchronize.
   */
  public get isNetworkSyncEnabled(): boolean {
    return !!this.objectBody && this.objectBody.bodyOptions.bodyType !== 'static';
  }

  /**
   * `INetworkSyncable`: owner-side snapshot of `objectBody` - see `RigidBodyCorrection`. In global
   * coordinates: converted through the world's `frame`.
   */
  public captureNetworkState(): RigidBodyNetState<Point3, Point4> {
    const frame = networkFrameOf(this.world);
    if (!this.objectBody) {
      const p = frame ? frame.toGlobalPoint(this.position) : this.position;
      const r = frame ? frame.toGlobalRotation(this.rotation) : this.rotation;
      return { p: quantizeNetPosition(p), r: quantizeNetRotation(r), lv: Pnt3.O, av: Pnt3.O, s: true };
    }
    return RigidBodyCorrection.capture(this.objectBody, frame);
  }

  /**
   * `INetworkSyncable`: replica-side correction of `objectBody` - see `RigidBodyCorrection`. `target` is
   * global, converted through the world's `frame` as it is now. No-op without a body.
   */
  public applyNetworkState(target: RigidBodyNetState<Point3, Point4>, ctx: NetworkApplyContext): CorrectionOutcome {
    return this.objectBody
      ? RigidBodyCorrection.correct(this.objectBody, target, ctx, undefined, networkFrameOf(this.world))
      : 'none';
  }
}
