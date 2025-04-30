import { GgWorld, GgWorldTypeDocRepo } from '../gg-world';
import { Observable, Subject } from 'rxjs';
import { IWorldComponent } from '../components/i-world-component';

/**
 * Engine's default tick orders: the less value, the earlier tick will be run.
 */
export enum TickOrder {
  INPUT_CONTROLLERS = 0,
  PHYSICS_SIMULATION = 200,
  OBJECTS_BINDING = 400,
  ANIMATION_MIXERS = 600,
  CONTROLLERS = 800,
  RENDERING = 1000,
  POST_RENDERING = 1200,
}

export abstract class IEntity<D = any, R = any, TypeDoc extends GgWorldTypeDocRepo<D, R> = GgWorldTypeDocRepo<D, R>> {
  private static default_name_counter = 0;
  /**
   * will receive [elapsed time, delta] of each world clock tick
   */
  readonly tick$: Subject<[number, number]> = new Subject<[number, number]>();
  /**
   * the priority of ticker: the less value, the earlier tick will be run.
   */
  abstract readonly tickOrder: TickOrder | number;

  /**
   * a world reference, where this entity was added to
   */
  protected _world: GgWorld<D, R, TypeDoc> | null = null;
  get world(): GgWorld<D, R, TypeDoc> | null {
    return this._world;
  }

  protected _name: string = 'e0x' + (IEntity.default_name_counter++).toString(16);

  public get name(): string {
    return this._name;
  }

  public set name(value: string) {
    this._name = value;
  }

  /**
   * The flag whether entity should listen to ticks. If set to false, ticks will not be propagated to this entity
   * */
  protected _selfActive: boolean = true;

  public get active(): boolean {
    return this._selfActive && (!this.parent || this.parent.active);
  }

  public set active(value: boolean) {
    this._selfActive = value;
  }

  public parent: IEntity | null = null;

  private _children: IEntity[] = [];

  public get children(): IEntity[] {
    return [...this._children];
  }

  public addChildren(...entities: IEntity[]) {
    for (const item of entities) {
      if (item.parent) {
        item.parent.removeChildren([item]);
      }
      item.parent = this;
    }
    this._children.push(...entities);
    if (this._world) {
      for (const item of entities) {
        this._world.addEntity(item);
      }
    }
  }

  public removeChildren(entities: IEntity[], dispose: boolean = false) {
    this._children = this._children.filter(c => !entities.includes(c));
    for (const item of entities) {
      item.parent = null;
      if (this._world) {
        this._world.removeEntity(item, dispose);
      }
    }
  }

  private _components: IWorldComponent<D, R, TypeDoc>[] = [];

  public get components(): IWorldComponent<D, R, TypeDoc>[] {
    return [...this._components];
  }

  public addComponents(...components: IWorldComponent<D, R, TypeDoc>[]) {
    for (const item of components) {
      if (item.entity) {
        item.entity.removeComponents([item]);
      }
      item.entity = this;
    }
    this._components.push(...components);
    if (this._world) {
      for (const item of components) {
        item.addToWorld(this._world);
      }
    }
  }

  public removeComponents(components: IWorldComponent<D, R, TypeDoc>[], dispose: boolean = false) {
    this._components = this._components.filter(c => !components.includes(c));
    for (const item of components) {
      item.entity = null;
      if (this._world) {
        item.removeFromWorld(this._world, dispose);
      }
    }
  }

  protected _onSpawned$: Subject<void> = new Subject<void>();
  protected _onRemoved$: Subject<void> = new Subject<void>();

  public get onSpawned$(): Observable<void> {
    return this._onSpawned$.asObservable();
  }

  public get onRemoved$(): Observable<void> {
    return this._onRemoved$.asObservable();
  }

  public onSpawned(world: GgWorld<D, R, TypeDoc>) {
    this._world = world;
    for (const c of this._components) {
      c.addToWorld(world);
    }
    for (const c of this._children) {
      world.addEntity(c);
    }
    this._onSpawned$.next();
  }

  public onRemoved() {
    const world = this._world!;
    this._world = null;
    for (const c of this._children) {
      world.removeEntity(c);
    }
    for (const c of this._components) {
      c.removeFromWorld(world, false);
    }
    this._onRemoved$.next();
  }

  // TODO add some flag to entity that it is disposed, and throw a normal error when trying to add such entity to world again
  public dispose(): void {
    if (this.world) {
      this.world.removeEntity(this, false);
    }
    this._onSpawned$.complete();
    this._onRemoved$.complete();
    this.tick$.complete();
    for (const c of this._children) {
      c.dispose();
    }
    for (const c of this._components) {
      c.dispose();
    }
  }
}
