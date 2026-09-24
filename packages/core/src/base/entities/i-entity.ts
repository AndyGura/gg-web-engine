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
   * Per-`entityTypeName` counters backing the `` `${entityTypeName}_${n}` `` default name scheme -
   * see {@link entityTypeName}.
   */
  private static defaultNameCountersByType: Map<string, number> = new Map();

  /**
   * Optional class-identifying tag a concrete subclass declares (`static readonly entityTypeName =
   * 'MyEntity';`) to make its own instances' auto-generated default names read as
   * `` `${entityTypeName}_${n}` `` (`n` a counter scoped to that tag) instead of the opaque
   * `'e0x...'` fallback every untagged class still gets. Read off `this.constructor` at
   * construction time - ordinary JS static inheritance, so a subclass that doesn't declare its own
   * picks up its nearest ancestor's if that ancestor declared one, and only a class that wants a
   * more specific label than its parent's needs to redeclare it.
   *
   * Deliberately **not** derived from the class's own `Function.name`/`constructor.name`: a
   * production bundler commonly mangles that under minification, which would make the default name
   * meaningless (or, worse, differ between a dev build and a production build). A plain static
   * string property is untouched by minification. Every entity class `packages/core` itself defines
   * declares one; an app-defined or adapter-defined entity class may opt in the same way, or leave
   * it undeclared to keep the `'e0x...'` fallback.
   */
  static readonly entityTypeName?: string;

  /**
   * Transforms applied, in registration order, to every auto-generated default entity name (never
   * to a name explicitly assigned by app code or `LevelLoader`) - see
   * {@link useDefaultNameMiddleware}.
   */
  private static defaultNameMiddlewares: Array<(name: string) => string> = [];

  /**
   * Register a transform run on every subsequently-constructed entity's auto-generated default
   * name (see {@link entityTypeName}) at construction time, before anything else can touch it.
   * Multiple registrations chain in call order. This is the one seam a package with its own notion
   * of identity (e.g. a future network layer wanting to qualify every otherwise-unnamed entity with
   * a peer id) needs: app code keeps calling ordinary core factories/constructors with no awareness
   * such a layer exists, and every entity that isn't explicitly named by that app code or by
   * `LevelLoader` picks up the transform automatically. Core itself never calls this.
   * @param middleware - Receives the default name generated so far, returns the name to use
   */
  public static useDefaultNameMiddleware(middleware: (name: string) => string): void {
    IEntity.defaultNameMiddlewares.push(middleware);
  }

  private generateDefaultName(): string {
    const entityTypeName = (this.constructor as typeof IEntity).entityTypeName;
    let name: string;
    if (entityTypeName !== undefined) {
      const count = IEntity.defaultNameCountersByType.get(entityTypeName) ?? 0;
      IEntity.defaultNameCountersByType.set(entityTypeName, count + 1);
      name = `${entityTypeName}_${count}`;
    } else {
      name = 'e0x' + (IEntity.default_name_counter++).toString(16);
    }
    for (const middleware of IEntity.defaultNameMiddlewares) {
      name = middleware(name);
    }
    return name;
  }

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

  /**
   * Falls back to an auto-generated default (see {@link entityTypeName} and
   * {@link useDefaultNameMiddleware}) until explicitly assigned. Must be unique within whichever
   * `GgWorld` this entity is (or becomes) a member of - the `name` setter validates this itself
   * once the entity is spawned, and `GgWorld.addEntity` validates it at spawn time otherwise; both
   * throw on a collision.
   */
  protected _name: string = this.generateDefaultName();

  public get name(): string {
    return this._name;
  }

  public set name(value: string) {
    if (this._world) {
      this._world.renameEntity(this, value);
    }
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

  /**
   * Find a descendant entity by name, searching this entity's own children and their children
   * recursively (depth-first) - not the whole world, just this entity's subtree. Useful e.g. to
   * pull a specific entity back out of a `GroupEntity` a `LevelLoader` handed back:
   * `level.getChildEntityByName('KillFloor')`.
   * @param name - The descendant entity's `name`
   * @returns The matching descendant
   * @throws if no descendant has that name
   */
  public getChildEntityByName<T extends IEntity = IEntity>(name: string): T {
    const found = this.findChildEntityByName(name);
    if (!found) {
      throw new Error(`No child entity named "${name}" found under "${this.name}"`);
    }
    return found as T;
  }

  private findChildEntityByName(name: string): IEntity | undefined {
    for (const child of this._children) {
      if (child.name === name) {
        return child;
      }
      const found = child.findChildEntityByName(name);
      if (found) {
        return found;
      }
    }
    return undefined;
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
