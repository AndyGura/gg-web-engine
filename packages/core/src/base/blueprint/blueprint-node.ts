import { Observable, Subject } from 'rxjs';
import { GgWorld, GgWorldTypeDocRepo } from '../gg-world';

/**
 * Whether a {@link BlueprintNode} pin carries an execution pulse ("do this now", no meaningful
 * payload - e.g. Unreal's white exec pins) or a data value ("here's a value", not itself a
 * trigger - e.g. Unreal's colored data pins). Purely descriptive for now (introspection/future
 * editor tooling) - {@link BlueprintNode.trigger} treats every input pin the same way at runtime,
 * since a node is free to both react to and read a value from the same pin (see
 * {@link RemoveEntityBlueprintNode}, whose single `"entity"` pin is a data pin that also triggers
 * the node when fed a value - the same way an Unreal event node's payload pins double as the
 * thing that fires the node).
 */
export type BlueprintPinKind = 'exec' | 'data';

/**
 * Declares one named pin a {@link BlueprintNode} exposes - either an input (fed a value via
 * {@link BlueprintNode.trigger}) or an output (fired via {@link BlueprintNode.output}).
 */
export interface BlueprintPinDefinition {
  name: string;
  kind: BlueprintPinKind;
}

/**
 * One node in a {@link Blueprint} graph - the engine's analogue of a single Unreal Blueprint graph
 * node: a small unit of behavior with named input pins that trigger it, named output pins it can
 * fire in response, and a `settings` bag of static (non-pin) configuration baked in from its
 * {@link BlueprintNodeJson} (e.g. `RemoveEntity`'s `dispose` flag). Register a concrete subclass's
 * factory against a type alias via `LevelLoader.registerBlueprintNode` so `Blueprint` can
 * instantiate it from JSON, the same way `LevelLoader.registerClass` works for entity classes.
 * @template D - The position type
 * @template R - The rotation type
 * @template TypeDoc - The type document repository
 */
export abstract class BlueprintNode<
  D = any,
  R = any,
  TypeDoc extends GgWorldTypeDocRepo<D, R> = GgWorldTypeDocRepo<D, R>,
> {
  /**
   * This node's input pins - see {@link trigger} for how they're fed.
   */
  public abstract readonly inputs: readonly BlueprintPinDefinition[];

  /**
   * This node's output pins - see {@link output} for how to observe them.
   */
  public abstract readonly outputs: readonly BlueprintPinDefinition[];

  private readonly outputSubjects = new Map<string, Subject<unknown>>();

  constructor(
    protected readonly world: GgWorld<D, R, TypeDoc>,
    protected readonly settings: Record<string, any>,
  ) {}

  private subjectFor(name: string): Subject<unknown> {
    let subject = this.outputSubjects.get(name);
    if (!subject) {
      subject = new Subject<unknown>();
      this.outputSubjects.set(name, subject);
    }
    return subject;
  }

  /**
   * Observe one of this node's output pins firing - what a {@link BlueprintLinkJson} subscribes
   * to in order to feed a downstream node's input, or what an embedding `Blueprint`'s own
   * `outputs` entry bubbles up to whatever triggered the blueprint.
   * @param name - The output pin's name, per {@link outputs}
   */
  public output(name: string): Observable<unknown> {
    return this.subjectFor(name).asObservable();
  }

  /**
   * Fire one of this node's output pins - call from within {@link trigger} once the node has done
   * whatever that output represents. A no-op if nothing is subscribed.
   * @param name - The output pin's name, per {@link outputs}
   * @param value - Payload for a data output pin; omit for a bare exec pulse
   */
  protected emit(name: string, value?: unknown): void {
    this.subjectFor(name).next(value);
  }

  /**
   * Feed a value/pulse into one of this node's input pins (per {@link inputs}), running whatever
   * behavior that pin represents. Called by `Blueprint` both for external triggers (via its own
   * `inputs` aliasing) and for links from another node's output pin.
   * @param inputName - The input pin's name, per {@link inputs}
   * @param value - Payload carried in on a data pin, if any
   */
  public abstract trigger(inputName: string, value?: unknown): void;

  /**
   * Release anything this node set up outside of its output subjects (timers, subscriptions,
   * etc). Default no-op - override when a node needs it. `Blueprint.dispose` calls this on every
   * node in its graph.
   */
  public dispose(): void {}
}
