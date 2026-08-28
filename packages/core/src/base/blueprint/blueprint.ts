import { Observable, Subscription } from 'rxjs';
import { GgWorld, GgWorldTypeDocRepo } from '../gg-world';
import { BlueprintNode } from './blueprint-node';

/**
 * A function that builds a {@link BlueprintNode} instance from its baked-in settings. Registered
 * against a node type alias via `LevelLoader.registerBlueprintNode`, the same way
 * {@link EntityGenerator} is registered against an entity class alias via `registerClass`.
 * @template D - The position type
 * @template R - The rotation type
 * @template TypeDoc - The type document repository
 */
export type BlueprintNodeFactory<D, R, TypeDoc extends GgWorldTypeDocRepo<D, R>> = (
  world: GgWorld<D, R, TypeDoc>,
  settings: Record<string, any>,
) => BlueprintNode<D, R, TypeDoc>;

/**
 * A reference to one named pin on one node within a {@link BlueprintJson} graph - either end of a
 * {@link BlueprintLinkJson}, or what a graph's own `inputs`/`outputs` entry aliases.
 */
export interface BlueprintPinRef {
  /**
   * `id` of the node within the same `BlueprintJson.nodes` array
   */
  node: string;

  /**
   * Pin name on that node, per its `BlueprintNode.inputs`/`outputs`
   */
  pin: string;
}

/**
 * JSON description of a single node instance within a {@link BlueprintJson} graph.
 */
export interface BlueprintNodeJson {
  /**
   * Identifier for this node instance, unique within the same graph - referenced by
   * `BlueprintLinkJson`/`BlueprintJson.inputs`/`BlueprintJson.outputs`.
   */
  id: string;

  /**
   * Node type alias, matching a type registered via `LevelLoader.registerBlueprintNode` (e.g. the
   * built-in `"RemoveEntity"`).
   */
  type: string;

  /**
   * Static settings baked into the node (e.g. `RemoveEntity`'s `dispose` flag) - not wired at
   * runtime, unlike a pin.
   */
  settings?: Record<string, any>;
}

/**
 * JSON description of one wire connecting one node's output pin to another node's input pin
 * within the same {@link BlueprintJson} graph. Whenever `from` fires, `to` is triggered with
 * whatever value (if any) `from` fired with.
 */
export interface BlueprintLinkJson {
  from: BlueprintPinRef;
  to: BlueprintPinRef;
}

/**
 * A blueprint graph, serializable as a single JSON document - the engine's analogue of an Unreal
 * Blueprint event graph. `nodes` are node instances (see {@link BlueprintNodeJson}), `links` wire
 * one node's output pin to another's input pin, and `inputs`/`outputs` expose named entry/exit
 * points at the graph's own boundary - each aliasing one node's pin - so embedding code (or, in
 * the future, another blueprint nesting this one) doesn't need to know internal node ids. A level
 * JSON references a `BlueprintJson` by name via its top-level `blueprints` map and an entity's
 * `events` mapping - see `gg-engine-level-json`.
 */
export interface BlueprintJson {
  /**
   * Node instances in this graph
   */
  nodes: BlueprintNodeJson[];

  /**
   * Wires wiring one node's output pin to another node's input pin
   */
  links?: BlueprintLinkJson[];

  /**
   * Named entry points into this graph, each aliasing one node's input pin - e.g.
   * `{ "in": { "node": "n1", "pin": "entity" } }` lets external code trigger `"n1"`'s `"entity"`
   * pin by calling `blueprint.trigger("in", value)` without knowing the internal node id. A
   * blueprint bound to a level JSON entity event is always triggered through the entry named
   * `"in"` - see `gg-engine-level-json`.
   */
  inputs?: Record<string, BlueprintPinRef>;

  /**
   * Named exit points out of this graph, each aliasing one node's output pin - for a future
   * blueprint nested inside a larger graph to bubble one of its own nodes' outputs back out.
   */
  outputs?: Record<string, BlueprintPinRef>;
}

/**
 * Runtime instance of a {@link BlueprintJson} graph: builds one {@link BlueprintNode} per
 * `nodes` entry (via the node type registry passed in), wires every `links` entry as a live
 * subscription from the source node's output pin to the target node's input pin, and exposes the
 * graph's own `inputs`/`outputs` boundary. Each binding of a blueprint (e.g. one level JSON entity
 * event) gets its own `Blueprint` instance - and therefore its own node instances - even when
 * multiple bindings reference the same `BlueprintJson` by name, so per-node state (a future timer
 * node's countdown, etc) is never accidentally shared between unrelated bindings.
 * @template D - The position type
 * @template R - The rotation type
 * @template TypeDoc - The type document repository
 */
export class Blueprint<D = any, R = any, TypeDoc extends GgWorldTypeDocRepo<D, R> = GgWorldTypeDocRepo<D, R>> {
  private readonly nodes = new Map<string, BlueprintNode<D, R, TypeDoc>>();
  private readonly linkSubscriptions: Subscription[] = [];

  constructor(
    world: GgWorld<D, R, TypeDoc>,
    private readonly json: BlueprintJson,
    registry: ReadonlyMap<string, BlueprintNodeFactory<D, R, TypeDoc>>,
  ) {
    for (const nodeJson of json.nodes) {
      const factory = registry.get(nodeJson.type);
      if (!factory) {
        console.warn(`No blueprint node type registered for "${nodeJson.type}" - skipping node "${nodeJson.id}"`);
        continue;
      }
      this.nodes.set(nodeJson.id, factory(world, nodeJson.settings ?? {}));
    }

    for (const link of json.links ?? []) {
      const source = this.nodes.get(link.from.node);
      const target = this.nodes.get(link.to.node);
      if (!source || !target) {
        console.warn(
          `Blueprint link references an unknown node ("${link.from.node}" -> "${link.to.node}") - skipping`,
        );
        continue;
      }
      this.linkSubscriptions.push(
        source.output(link.from.pin).subscribe(value => target.trigger(link.to.pin, value)),
      );
    }
  }

  /**
   * Feed a value/pulse into one of this graph's named entry points (per `BlueprintJson.inputs`).
   * A no-op (with a console warning) if no such input, or the node it aliases failed to build.
   * @param inputName - Entry point name, per `BlueprintJson.inputs`
   * @param value - Payload to hand to the aliased node's input pin, if any
   */
  public trigger(inputName: string, value?: unknown): void {
    const ref = this.json.inputs?.[inputName];
    if (!ref) {
      console.warn(`Blueprint has no declared input named "${inputName}" - ignoring trigger`);
      return;
    }
    const node = this.nodes.get(ref.node);
    if (!node) {
      return;
    }
    node.trigger(ref.pin, value);
  }

  /**
   * Observe one of this graph's named exit points (per `BlueprintJson.outputs`) firing.
   * @param outputName - Exit point name, per `BlueprintJson.outputs`
   * @throws if no such output is declared, or the node it aliases failed to build
   */
  public output(outputName: string): Observable<unknown> {
    const ref = this.json.outputs?.[outputName];
    if (!ref) {
      throw new Error(`Blueprint has no declared output named "${outputName}"`);
    }
    const node = this.nodes.get(ref.node);
    if (!node) {
      throw new Error(`Blueprint output "${outputName}" references unknown node "${ref.node}"`);
    }
    return node.output(ref.pin);
  }

  /**
   * Unwire every link and dispose every node in this graph. Idempotent-ish - safe to call once
   * per `Blueprint` instance, same lifetime contract as `IEntity.dispose`.
   */
  public dispose(): void {
    for (const sub of this.linkSubscriptions) {
      sub.unsubscribe();
    }
    this.linkSubscriptions.splice(0, this.linkSubscriptions.length);
    for (const node of this.nodes.values()) {
      node.dispose();
    }
  }
}
