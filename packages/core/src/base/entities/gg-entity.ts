import { GgWorld } from '../gg-world';
import { Subject } from 'rxjs';

/**
 * Engine's default tick orders: the less value, the earlier tick will be run.
 */
export enum GGTickOrder {
  INPUT_CONTROLLERS = 0,
  PHYSICS_SIMULATION = 200,
  OBJECTS_BINDING = 400,
  ANIMATION_MIXERS = 600,
  CONTROLLERS = 800,
  RENDERING = 1000,
  POST_RENDERING = 1200,
}

export abstract class GgEntity {
  private static default_name_counter = 0;
  /**
   * will receive [elapsed time, delta] of each world clock tick
   */
  readonly tick$: Subject<[number, number]> = new Subject<[number, number]>();
  /**
   * the priority of ticker: the less value, the earlier tick will be run.
   */
  abstract readonly tickOrder: GGTickOrder | number;

  /**
   * a world reference, where this entity was added to
   */
  protected _world: GgWorld<any, any> | null = null;
  get world(): GgWorld<any, any> | null {
    return this._world;
  }

  protected _name: string = '0x' + (GgEntity.default_name_counter++).toString(16);

  public get name(): string {
    return this._name;
  }

  public set name(value: string) {
    this._name = value;
  }

  /**
   * The flag whether entity should listen to ticks. If set to false, ticks will not be propagated to this entity
   * */
  protected _active: boolean = true;

  public get active(): boolean {
    return this._active;
  }

  public set active(value: boolean) {
    this._active = value;
  }

  public parent: GgEntity | null = null;

  protected _children: GgEntity[] = [];

  public get children(): GgEntity[] {
    return [...this._children];
  }

  public addChildren(...entities: GgEntity[]) {
    for (const entity of entities) {
      if (entity.parent) {
        entity.parent.removeChildren([entity]);
      }
      entity.parent = this;
    }
    this._children.push(...entities);
    if (this._world) {
      for (const item of entities) {
        this._world.addEntity(item);
      }
    }
  }

  public removeChildren(entities: GgEntity[], dispose: boolean = false) {
    this._children = this._children.filter(c => !entities.includes(c));
    for (const item of entities) {
      item.parent = null;
      if (this._world) {
        this._world.removeEntity(item, dispose);
      }
    }
  }

  protected _onSpawned$: Subject<void> = new Subject<void>();
  protected _onRemoved$: Subject<void> = new Subject<void>();

  public onSpawned(world: GgWorld<any, any>) {
    this._world = world;
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
  }
}
