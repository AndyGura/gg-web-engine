import { EMPTY, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IEntity, Pnt2, Point2, TickOrder } from '../../base';
import { IPositionable2d } from '../interfaces/i-positionable-2d';
import { IRenderable2dEntity } from './i-renderable-2d.entity';
import { Gg2dWorldTypeDocPPatch, Gg2dWorldTypeDocRepo, PhysicsTypeDocRepo2D } from '../gg-2d-world';

export class Entity2d<TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo>
  extends IRenderable2dEntity<TypeDoc>
  implements IPositionable2d
{
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;

  /**
   * Fires each time this entity's body begins touching another rigid body it wasn't already
   * touching - see `IRigidBodyComponent.onCollisionStart`. `entity` is the other body's owning
   * entity, if it has one (same convention `Trigger2dEntity.onEntityEntered` uses). Entities with
   * no physics body (`objectBody` unset) never emit.
   */
  get onCollisionStart(): Observable<{
    entity:
      (IEntity<Point2, number, Gg2dWorldTypeDocRepo & { pTypeDoc: TypeDoc['pTypeDoc'] }> & IPositionable2d) | null;
    otherBody: TypeDoc['pTypeDoc']['rigidBody'];
    position: Point2;
    normal: Point2;
    relativeVelocity: Point2;
    impulse: number;
  }> {
    if (!this.objectBody) {
      return EMPTY;
    }
    return this.objectBody.onCollisionStart.pipe(
      map(evt => ({
        ...evt,
        entity: (evt.otherBody.entity ?? null) as
          (IEntity<Point2, number, Gg2dWorldTypeDocPPatch<PhysicsTypeDocRepo2D>> & IPositionable2d) | null,
      })),
    );
  }

  /**
   * Fires each time this entity's body stops touching a rigid body it was previously touching -
   * see `IRigidBodyComponent.onCollisionEnd`. `null` when the other body was removed from the
   * world while still in contact, or when it (or its entity) can't be resolved.
   */
  get onCollisionEnd(): Observable<
    (IEntity<Point2, number, Gg2dWorldTypeDocRepo & { pTypeDoc: TypeDoc['pTypeDoc'] }> & IPositionable2d) | null
  > {
    if (!this.objectBody) {
      return EMPTY;
    }
    return this.objectBody.onCollisionEnd.pipe(
      map(
        otherBody =>
          (otherBody?.entity ?? null) as
            (IEntity<Point2, number, Gg2dWorldTypeDocPPatch<PhysicsTypeDocRepo2D>> & IPositionable2d) | null,
      ),
    );
  }

  private _position = Pnt2.O;
  public get position(): Point2 {
    return this._position;
  }

  set position(value: Point2) {
    if (this.object2D) {
      this.object2D.position = value;
    }
    if (this.objectBody) {
      this.objectBody.position = value;
    }
    this._position = value;
  }

  private _rotation = 0;
  public get rotation(): number {
    return this._rotation;
  }

  set rotation(value: number) {
    if (this.object2D) {
      this.object2D.rotation = value;
    }
    if (this.objectBody) {
      this.objectBody.rotation = value;
    }
    this._rotation = value;
  }

  public readonly object2D: TypeDoc['vTypeDoc']['displayObject'] | null = null;
  public readonly objectBody: TypeDoc['pTypeDoc']['rigidBody'] | null = null;

  public updateVisibility(): void {
    if (this.object2D) {
      this.object2D.visible = this.worldVisible;
    }
    super.updateVisibility();
  }

  /**
   * Synchronize physics body transform with entity (and object2d if defined)
   * */
  protected runTransformBinding(
    objectBody: TypeDoc['pTypeDoc']['rigidBody'],
    object2D: TypeDoc['vTypeDoc']['displayObject'] | null,
  ): void {
    const pos = objectBody.position;
    const quat = objectBody.rotation;
    if (object2D) {
      object2D.position = pos;
      object2D.rotation = quat;
    }
    this._position = pos;
    this._rotation = quat;
  }

  constructor(options: {
    object2D?: TypeDoc['vTypeDoc']['displayObject'];
    objectBody?: TypeDoc['pTypeDoc']['rigidBody'];
  }) {
    super();
    if (options.objectBody) {
      this.objectBody = options.objectBody;
      if (this.objectBody.name) {
        this.name = this.objectBody.name;
      }
      this.addComponents(this.objectBody);
    }
    if (options.object2D) {
      this.object2D = options.object2D;
      if (!options.objectBody) {
        this._position = this.object2D.position;
        this._rotation = this.object2D.rotation;
        if (this.object2D.name) {
          this.name = this.object2D.name;
        }
      }
      this.addComponents(this.object2D);
    }
    if (this.objectBody) {
      this.tick$.subscribe(() => {
        this.runTransformBinding(this.objectBody!, this.object2D);
      });
      this.runTransformBinding(this.objectBody, this.object2D);
    }
  }
}
