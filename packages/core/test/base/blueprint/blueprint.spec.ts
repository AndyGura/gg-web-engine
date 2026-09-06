import {
  Blueprint,
  BlueprintJson,
  BlueprintNode,
  BlueprintNodeFactory,
  BlueprintPinDefinition,
  GgWorld,
} from '../../../src';
import { MockWorld } from '../../mocks/world.mock';

/** A trivial node used to exercise `Blueprint` wiring: echoes its "in" input onto its "out" output. */
class PassThroughNode extends BlueprintNode {
  public readonly inputs: readonly BlueprintPinDefinition[] = [{ name: 'in', kind: 'data' }];
  public readonly outputs: readonly BlueprintPinDefinition[] = [{ name: 'out', kind: 'data' }];
  public readonly triggered: unknown[] = [];

  public trigger(inputName: string, value?: unknown): void {
    if (inputName !== 'in') {
      return;
    }
    this.triggered.push(value);
    this.emit('out', value);
  }
}

describe('Blueprint', () => {
  let world: GgWorld<any, any>;
  let registry: Map<string, BlueprintNodeFactory<any, any, any>>;
  let nodes: PassThroughNode[];

  beforeEach(() => {
    world = new MockWorld();
    nodes = [];
    registry = new Map();
    registry.set('PassThrough', (w, settings) => {
      const node = new PassThroughNode(w, settings);
      nodes.push(node);
      return node;
    });
  });

  it('builds one node instance per entry in "nodes", passing along its settings', () => {
    const json: BlueprintJson = {
      nodes: [{ id: 'n1', type: 'PassThrough', settings: { foo: 'bar' } }],
    };

    new Blueprint(world, json, registry);

    expect(nodes).toHaveLength(1);
    expect((nodes[0] as any).settings).toEqual({ foo: 'bar' });
  });

  it('warns and skips a node whose type has no registered factory', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const json: BlueprintJson = {
      nodes: [{ id: 'n1', type: 'Unregistered' }],
    };

    expect(() => new Blueprint(world, json, registry)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith('No blueprint node type registered for "Unregistered" - skipping node "n1"');

    warnSpy.mockRestore();
  });

  it('triggers the node aliased by a declared input when Blueprint.trigger is called', () => {
    const json: BlueprintJson = {
      nodes: [{ id: 'n1', type: 'PassThrough' }],
      inputs: { in: { node: 'n1', pin: 'in' } },
    };

    const blueprint = new Blueprint(world, json, registry);
    blueprint.trigger('in', 42);

    expect(nodes[0].triggered).toEqual([42]);
  });

  it('warns and does nothing when triggering an undeclared input', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const json: BlueprintJson = { nodes: [{ id: 'n1', type: 'PassThrough' }] };

    const blueprint = new Blueprint(world, json, registry);
    blueprint.trigger('nope', 1);

    expect(nodes[0].triggered).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith('Blueprint has no declared input named "nope" - ignoring trigger');

    warnSpy.mockRestore();
  });

  it('wires a link from one node output to another node input', () => {
    const json: BlueprintJson = {
      nodes: [
        { id: 'n1', type: 'PassThrough' },
        { id: 'n2', type: 'PassThrough' },
      ],
      links: [{ from: { node: 'n1', pin: 'out' }, to: { node: 'n2', pin: 'in' } }],
      inputs: { in: { node: 'n1', pin: 'in' } },
    };

    const blueprint = new Blueprint(world, json, registry);
    blueprint.trigger('in', 'hello');

    expect(nodes[0].triggered).toEqual(['hello']);
    expect(nodes[1].triggered).toEqual(['hello']);
  });

  it('exposes a declared output backed by a node output pin', () => {
    const json: BlueprintJson = {
      nodes: [{ id: 'n1', type: 'PassThrough' }],
      inputs: { in: { node: 'n1', pin: 'in' } },
      outputs: { out: { node: 'n1', pin: 'out' } },
    };

    const blueprint = new Blueprint(world, json, registry);
    const received: unknown[] = [];
    blueprint.output('out').subscribe(v => received.push(v));
    blueprint.trigger('in', 'value');

    expect(received).toEqual(['value']);
  });

  it('throws when reading an undeclared output', () => {
    const json: BlueprintJson = { nodes: [{ id: 'n1', type: 'PassThrough' }] };
    const blueprint = new Blueprint(world, json, registry);

    expect(() => blueprint.output('nope')).toThrow('Blueprint has no declared output named "nope"');
  });

  it('unsubscribes links and disposes every node on dispose()', () => {
    const json: BlueprintJson = {
      nodes: [
        { id: 'n1', type: 'PassThrough' },
        { id: 'n2', type: 'PassThrough' },
      ],
      links: [{ from: { node: 'n1', pin: 'out' }, to: { node: 'n2', pin: 'in' } }],
      inputs: { in: { node: 'n1', pin: 'in' } },
    };

    const blueprint = new Blueprint(world, json, registry);
    const disposeSpies = nodes.map(n => jest.spyOn(n, 'dispose'));

    blueprint.dispose();
    blueprint.trigger('in', 'after-dispose');

    disposeSpies.forEach(spy => expect(spy).toHaveBeenCalled());
    // the link was unsubscribed, so n2 never sees the post-dispose trigger relayed through n1
    expect(nodes[1].triggered).toEqual([]);
  });
});
