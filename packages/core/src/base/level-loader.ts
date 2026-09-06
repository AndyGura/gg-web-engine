import { Observable, Subscription } from 'rxjs';
import { GgWorld, GgWorldTypeDocRepo } from './gg-world';
import { GroupEntity } from './entities/group.entity';
import { IEntity, TickOrder } from './entities/i-entity';
import { Blueprint, BlueprintJson, BlueprintNodeFactory } from './blueprint/blueprint';
import { RemoveEntityBlueprintNode } from './blueprint/nodes/remove-entity.node';

/**
 * A function that turns per-entity JSON settings into a spawned `IEntity` (e.g. a primitive body,
 * a trigger, a camera). Registered against a class alias via {@link LevelLoader.registerClass}.
 * May be `async`/return a `Promise` (e.g. the built-in `"Glb"` 3D class, which fetches a model) -
 * {@link LevelLoader.loadLevel} awaits every generator before moving to the next entity. A
 * generator that returns anything other than an `IEntity` (including `null`/`undefined`) has its
 * result discarded - see {@link LevelLoader.loadLevel}.
 * @template D - The position type
 * @template R - The rotation type
 * @template TypeDoc - The type document repository
 * @template Settings - The settings object type
 * @template W - The world type
 */
export type EntityGenerator<
  D,
  R,
  TypeDoc extends GgWorldTypeDocRepo<D, R>,
  Settings = any,
  W = GgWorld<D, R, TypeDoc>,
> = (world: W, settings: Settings) => any;

/**
 * A level/scene, serializable as a single JSON document (e.g. to be hosted as a static file and
 * loaded via {@link LevelLoader.loadLevelFromUrl}).
 */
export interface LevelJson {
  /**
   * Entities in the level
   */
  entities: EntityJson[];

  /**
   * Blueprint graphs available to this level's entities, keyed by name - referenced from an
   * `EntityJson.events` entry to run a blueprint whenever the named observable on that entity
   * fires. See {@link BlueprintJson} and the `gg-engine-level-json` skill's "Blueprints" section.
   */
  blueprints?: Record<string, BlueprintJson>;
}

/**
 * JSON description of a single entity in a level. `position`/`rotation` are left untyped here
 * since their shape depends on the dimensionality (`Point2`/`number` for 2D, `Point3`/`Point4`
 * for 3D) of whichever `LevelLoader` subclass parses this JSON.
 */
export interface EntityJson {
  /**
   * Class alias for the entity, matching a class registered via `registerClass`. Built-in
   * primitive shapes (box/sphere/square/circle/...) all share the single `"Primitive"` alias and
   * are distinguished by `shape` instead of by a per-shape class - e.g. `{ class: "Primitive",
   * shape: "BOX" }` rather than `{ class: "BOX" }`. Apps register their own aliases (e.g.
   * `"ShapeSpawner"`) the same way the dimensionality-specific `LevelLoader` subclasses register
   * their built-ins, via `registerClass`.
   */
  class: string;

  /**
   * Shape identifier for the built-in `"Primitive"` entity class (e.g. `"Box"`, `"Circle"`) - see
   * the dimensionality-specific `LevelLoader` subclass (`Gg2dLevelLoader`/`Gg3dLevelLoader`) for
   * the supported values. Ignored for any other `class`.
   */
  shape?: string;

  /**
   * Position of the entity
   */
  position?: any;

  /**
   * Rotation of the entity
   */
  rotation?: any;

  /**
   * Name of the entity. `loadLevel` sets the generator's returned `IEntity`'s `.name` to this
   * (overriding whatever default the generator gave it), so it can be found afterwards with
   * `GgWorld.getEntityByName`/`IEntity.getChildEntityByName`. Moot if the generator doesn't return
   * an `IEntity` - that result is discarded (with a console warning) before naming is applied.
   */
  name?: string;

  /**
   * Configuration for the entity, passed to its generator alongside position/rotation/name
   */
  config?: any;

  /**
   * Maps an observable property name on this entity's generated `IEntity` (e.g. `Trigger3dEntity`'s
   * `"onEntityEntered"`) to what should run whenever that observable fires - see
   * {@link EntityEventBinding}. `loadLevel` subscribes to the observable and triggers a fresh
   * `Blueprint` instance (via its `"in"` entry point) with whatever value it emits, each time it
   * fires - see `LevelLoader.loadLevel` and the `gg-engine-level-json` skill's "Blueprints"
   * section. Silently ignored (with a console warning) if the binding can't be resolved to a
   * blueprint, or the named property isn't an `Observable`.
   */
  events?: Record<string, EntityEventBinding>;
}

/**
 * What an `EntityJson.events` entry runs. Either:
 * - a plain `string` - first tried as a key into the level's top-level `blueprints` map (a named,
 *   possibly multi-node graph); if not found there, tried as a blueprint node type alias
 *   registered via `registerBlueprintNode` (e.g. the built-in `"RemoveEntity"`) instead, with no
 *   settings - shorthand for the single-node form below with `settings` omitted.
 * - `{ type, settings? }` - a single built-in/registered blueprint node used directly as the
 *   handler, with inline `settings`, no `blueprints` entry needed at all - e.g.
 *   `{ "type": "RemoveEntity", "settings": { "dispose": true } }`. Only node types registered with
 *   a default input pin (every built-in one is - see `registerBlueprintNode`) support this form;
 *   others require a full graph declared in `blueprints` instead, addressing the desired input pin
 *   explicitly via `inputs`.
 */
export type EntityEventBinding = string | { type: string; settings?: Record<string, any> };

/**
 * Base class for level loaders: parses a {@link LevelJson} document into world entities by
 * dispatching each `EntityJson.class` to a generator function registered with {@link registerClass}.
 *
 * A generator is required to return an `IEntity`. Every `IEntity` a generator produces is parented
 * under one {@link GroupEntity} per `loadLevel`/`loadLevelFromUrl` call (added to the world
 * immediately, and handed back once loading completes) - so a whole level can be torn down in one
 * shot with `world.removeEntity(level, true)`, which cascades removal/disposal to every child, and
 * any named entity can be found afterwards with `level.getChildEntityByName(name)`. If a generator
 * returns anything other than an `IEntity` (including `null`/`undefined`), `loadLevel` logs a
 * `console.warn` and skips that entity - it's never parented, named, or tracked.
 * @template D - The position type
 * @template R - The rotation type
 * @template TypeDoc - The type document repository
 */
export abstract class LevelLoader<D, R, TypeDoc extends GgWorldTypeDocRepo<D, R>> {
  /**
   * Map of class aliases to generator functions
   */
  protected generators: Map<string, EntityGenerator<D, R, TypeDoc, any, any>> = new Map();

  /**
   * Map of blueprint node type aliases to node factory functions - see {@link registerBlueprintNode}.
   */
  protected blueprintNodes: Map<string, BlueprintNodeFactory<D, R, TypeDoc>> = new Map();

  /**
   * Map of blueprint node type aliases to their default input pin name, for node types registered
   * with one - see {@link registerBlueprintNode}.
   */
  protected blueprintNodeDefaultInputs: Map<string, string> = new Map();

  /**
   * Constructor
   * @param world - The world instance
   */
  constructor(protected readonly world: GgWorld<D, R, TypeDoc>) {
    this.registerBlueprintNode(
      'RemoveEntity',
      (w, settings) => new RemoveEntityBlueprintNode<D, R, TypeDoc>(w, settings),
      'entity',
    );
  }

  /**
   * Register a generator function for a class alias
   * @param classAlias - The class alias
   * @param generator - The generator function
   */
  public registerClass<Settings, W = any>(
    classAlias: string,
    generator: EntityGenerator<D, R, TypeDoc, Settings, W>,
  ): void {
    this.generators.set(classAlias, generator);
  }

  /**
   * Register a {@link BlueprintNode} factory for a node type alias, so a `BlueprintJson`'s
   * `nodes` can reference it by `type` (e.g. the built-in `"RemoveEntity"`, registered by every
   * `LevelLoader` out of the box). Same pattern as {@link registerClass}, one level down (node
   * types within a blueprint graph, rather than entity classes within a level).
   * @param typeAlias - The node type alias
   * @param factory - Builds a node instance from its baked-in settings
   * @param defaultInputPin - This node type's sole "trigger me" input pin name, if it has one
   * canonical one (e.g. `"RemoveEntity"`'s `"entity"`). Enables the node type to be used directly
   * as an `EntityJson.events` binding (`{ "eventName": "TypeAlias" }` or
   * `{ "eventName": { "type": "TypeAlias", "settings": {...} } }`) without declaring a full
   * `BlueprintJson` graph in `blueprints` - see {@link EntityEventBinding}. Omit for a node type
   * with zero or multiple input pins, or one with no single obviously-correct default; it remains
   * usable from a full graph either way.
   */
  public registerBlueprintNode(
    typeAlias: string,
    factory: BlueprintNodeFactory<D, R, TypeDoc>,
    defaultInputPin?: string,
  ): void {
    this.blueprintNodes.set(typeAlias, factory);
    if (defaultInputPin !== undefined) {
      this.blueprintNodeDefaultInputs.set(typeAlias, defaultInputPin);
    } else {
      this.blueprintNodeDefaultInputs.delete(typeAlias);
    }
  }

  /**
   * Load a level from an already-parsed JSON document. Every `IEntity` the level's entities
   * produce is parented under - and, on failure, torn down along with - the returned
   * {@link GroupEntity}, already added to the world.
   * @param levelJson - The level JSON
   * @param levelName - Optional name for the returned group entity (e.g. so a debugger/console
   * listing entities by name shows something more meaningful than the default auto-generated one)
   * @returns The level's root group entity
   */
  public async loadLevel(levelJson: LevelJson, levelName?: string): Promise<GroupEntity<D, R, TypeDoc>> {
    const level = new GroupEntity<D, R, TypeDoc>();
    if (levelName !== undefined) {
      level.name = levelName;
    }
    this.world.addEntity(level);

    try {
      for (const entityJson of levelJson.entities) {
        const { class: classAlias, shape, position, rotation, name, config, events } = entityJson;
        const generator = this.generators.get(classAlias);
        if (!generator) {
          console.warn(`No generator registered for class alias "${classAlias}"`);
          continue;
        }

        const settings = {
          ...(config ?? {}),
          ...(shape !== undefined ? { shape } : {}),
          ...(position !== undefined ? { position } : {}),
          ...(rotation !== undefined ? { rotation } : {}),
          ...(name !== undefined ? { name } : {}),
        };

        const entity = await generator(this.world, settings);
        if (!(entity instanceof IEntity)) {
          console.warn(`Generator for class alias "${classAlias}" did not return an IEntity - skipping`);
          continue;
        }
        if (name !== undefined) {
          entity.name = name;
        }
        // addChildren reparents the entity under level regardless of whether a generator already
        // self-added it to the world (e.g. addPrimitiveRigidBody does) - safe either way.
        level.addChildren(entity);

        if (events) {
          for (const [eventName, eventBinding] of Object.entries(events)) {
            const bindingEntity = this.bindEvent(entity, eventName, eventBinding, levelJson.blueprints);
            if (bindingEntity) {
              level.addChildren(bindingEntity);
            }
          }
        }
      }
    } catch (e) {
      // Don't leave a partially-loaded level (and its already-spawned entities) behind if a
      // generator throws partway through - the caller never gets `level` back to clean it up itself.
      this.world.removeEntity(level, true);
      throw e;
    }

    return level;
  }

  /**
   * Resolve `eventBinding` (see {@link EntityEventBinding}) to a `BlueprintJson`, instantiate a
   * fresh `Blueprint` from it, and subscribe it to `entity[eventName]` so every value that
   * observable emits triggers the blueprint's `"in"` entry point. Wrapped in a
   * `BlueprintBindingEntity` so the subscription (and the blueprint's own node state) is torn down
   * automatically once that entity is disposed - the caller parents the returned entity under the
   * level's group for that reason.
   * @param entity - The entity carrying the observable property
   * @param eventName - Name of the observable property on `entity`
   * @param eventBinding - What to run - a `blueprints` name, a bare node type alias, or `{ type,
   * settings? }`
   * @param blueprints - The level's top-level blueprint map, if any
   * @returns The binding entity to parent under the level, or `undefined` if `eventBinding`
   * couldn't be resolved or the named property isn't an `Observable` (both logged via
   * `console.warn`)
   */
  private bindEvent(
    entity: IEntity<D, R, TypeDoc>,
    eventName: string,
    eventBinding: EntityEventBinding,
    blueprints: Record<string, BlueprintJson> | undefined,
  ): BlueprintBindingEntity<D, R, TypeDoc> | undefined {
    const blueprintJson = this.resolveEventBlueprint(eventName, eventBinding, blueprints);
    if (!blueprintJson) {
      return undefined;
    }
    const observable = (entity as any)[eventName];
    if (!observable || typeof observable.subscribe !== 'function') {
      console.warn(`Entity has no observable property "${eventName}" to bind a blueprint to`);
      return undefined;
    }
    const blueprint = new Blueprint<D, R, TypeDoc>(this.world, blueprintJson, this.blueprintNodes);
    return new BlueprintBindingEntity<D, R, TypeDoc>(blueprint, observable as Observable<unknown>);
  }

  /**
   * Turn an `EntityEventBinding` into a `BlueprintJson` to run. An object form (`{ type,
   * settings? }`) always builds a single-node inline graph via {@link inlineNodeBlueprint}. A
   * string form is tried first as a key into `blueprints` (a named, possibly multi-node graph),
   * then - if not found there - as a bare node type alias, same as the object form with no
   * settings.
   * @param eventName - Name of the observable property being bound, for warning messages
   * @param eventBinding - The binding to resolve
   * @param blueprints - The level's top-level blueprint map, if any
   * @returns The resolved graph, or `undefined` (logged via `console.warn`) if it couldn't be
   */
  private resolveEventBlueprint(
    eventName: string,
    eventBinding: EntityEventBinding,
    blueprints: Record<string, BlueprintJson> | undefined,
  ): BlueprintJson | undefined {
    if (typeof eventBinding === 'object') {
      return this.inlineNodeBlueprint(eventName, eventBinding.type, eventBinding.settings);
    }
    const named = blueprints?.[eventBinding];
    if (named) {
      return named;
    }
    if (this.blueprintNodes.has(eventBinding)) {
      return this.inlineNodeBlueprint(eventName, eventBinding, undefined);
    }
    console.warn(
      `No blueprint or blueprint node type named "${eventBinding}" found for event "${eventName}" - skipping`,
    );
    return undefined;
  }

  /**
   * Build a single-node `BlueprintJson` wrapping one blueprint node type, wired so the node's
   * registered default input pin (see {@link registerBlueprintNode}) is reachable as `"in"` - what
   * powers the `EntityEventBinding` shorthand that skips declaring a `blueprints` entry entirely.
   * @param eventName - Name of the observable property being bound, for warning messages
   * @param nodeType - The blueprint node type alias
   * @param settings - Settings to bake into the node, if any
   * @returns The single-node graph, or `undefined` (logged via `console.warn`) if `nodeType` isn't
   * registered, or was registered without a default input pin
   */
  private inlineNodeBlueprint(
    eventName: string,
    nodeType: string,
    settings: Record<string, any> | undefined,
  ): BlueprintJson | undefined {
    if (!this.blueprintNodes.has(nodeType)) {
      console.warn(`No blueprint node type registered for "${nodeType}" (event "${eventName}") - skipping`);
      return undefined;
    }
    const inputPin = this.blueprintNodeDefaultInputs.get(nodeType);
    if (!inputPin) {
      console.warn(
        `Blueprint node type "${nodeType}" has no default input pin registered - event "${eventName}" must ` +
          `reference a full graph declared in "blueprints" instead, addressing the desired pin explicitly`,
      );
      return undefined;
    }
    return {
      nodes: [{ id: 'n1', type: nodeType, settings }],
      inputs: { in: { node: 'n1', pin: inputPin } },
    };
  }

  /**
   * Fetch a level JSON document hosted at `url` and load it, so a whole level/scene can be
   * shipped and consumed as a single static JSON file.
   * @param url - URL (or path) of the level JSON document
   * @param levelName - Optional name for the returned group entity, see {@link loadLevel}
   * @returns The level's root group entity
   */
  public async loadLevelFromUrl(url: string, levelName?: string): Promise<GroupEntity<D, R, TypeDoc>> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load level JSON from "${url}": ${response.status} ${response.statusText}`);
    }
    const levelJson: LevelJson = await response.json();
    return this.loadLevel(levelJson, levelName);
  }
}

/**
 * Plain do-nothing `IEntity` that owns one event-to-blueprint binding created by
 * `LevelLoader.bindEvent`: subscribes to the bound observable on construction, and unsubscribes
 * plus disposes the `Blueprint` on `dispose()`. Parented under the level's group entity like any
 * other level-produced entity, so `world.removeEntity(level, true)` tears the binding down along
 * with the rest of the level - there is nothing else app code needs to do to clean it up.
 * @template D - The position type
 * @template R - The rotation type
 * @template TypeDoc - The type document repository
 */
class BlueprintBindingEntity<D, R, TypeDoc extends GgWorldTypeDocRepo<D, R>> extends IEntity<D, R, TypeDoc> {
  public readonly tickOrder = TickOrder.CONTROLLERS;
  private readonly subscription: Subscription;

  constructor(
    private readonly blueprint: Blueprint<D, R, TypeDoc>,
    observable: Observable<unknown>,
  ) {
    super();
    this.subscription = observable.subscribe(value => this.blueprint.trigger('in', value));
  }

  public override dispose(): void {
    this.subscription.unsubscribe();
    this.blueprint.dispose();
    super.dispose();
  }
}
