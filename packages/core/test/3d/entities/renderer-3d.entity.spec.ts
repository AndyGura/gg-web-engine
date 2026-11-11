import { IRenderer3dComponent, Point2, Renderer3dEntity, Renderer3dOptions } from '../../../src';

/** A 3D renderer component that draws nothing: only its options and flags are under test. */
class TestRenderer3dComponent extends IRenderer3dComponent {
  camera: any = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
  physicsDebugViewActive = false;
  readonly changes: boolean[] = [];

  constructor(options?: Partial<Renderer3dOptions>) {
    super({} as any, undefined, options);
  }

  protected override onDrawBackdropsChanged(): void {
    this.changes.push(this.drawBackdrops);
  }

  drawn<B>(world: { backdrops: ReadonlyArray<B> } | null): ReadonlyArray<B> {
    return this.backdropsToDraw(world);
  }

  setResolution(): void {}
  resizeRenderer(_: Point2): void {}
  render(): void {}
  addToWorld(): void {}
  removeFromWorld(): void {}
  dispose(): void {}
}

describe('Renderer3dEntity drawBackdrops', () => {
  it('starts from the drawBackdrops renderer option, on by default', () => {
    expect(new TestRenderer3dComponent().drawBackdrops).toBe(true);
    expect(new TestRenderer3dComponent({}).drawBackdrops).toBe(true);
    expect(new TestRenderer3dComponent({ drawBackdrops: undefined }).drawBackdrops).toBe(true);
    expect(new TestRenderer3dComponent({ drawBackdrops: true }).drawBackdrops).toBe(true);
    expect(new TestRenderer3dComponent({ drawBackdrops: false }).drawBackdrops).toBe(false);
  });

  it('is stored once, in rendererOptions, which a change keeps current', () => {
    const component = new TestRenderer3dComponent();
    expect(component.rendererOptions.drawBackdrops).toBe(true);
    component.drawBackdrops = false;
    expect(component.rendererOptions.drawBackdrops).toBe(false);
    // a renderer rebuilt from the options of this one draws what this one draws
    expect(new TestRenderer3dComponent(component.rendererOptions).drawBackdrops).toBe(false);
  });

  it('reports a change to the adapter, and only a change', () => {
    const component = new TestRenderer3dComponent();
    component.drawBackdrops = true;
    component.drawBackdrops = false;
    component.drawBackdrops = false;
    component.drawBackdrops = true;
    expect(component.changes).toEqual([false, true]);
  });

  it('decides which backdrops backdropsToDraw gives', () => {
    const component = new TestRenderer3dComponent();
    const world = { backdrops: ['far', 'near'] };
    expect(component.drawn(world)).toEqual(['far', 'near']);
    expect(component.drawn(null)).toEqual([]);
    component.drawBackdrops = false;
    expect(component.drawn(world)).toEqual([]);
  });

  it('is proxied by the entity both ways', () => {
    const component = new TestRenderer3dComponent({ drawBackdrops: false });
    const entity = new Renderer3dEntity(component);
    expect(entity.drawBackdrops).toBe(false);
    entity.drawBackdrops = true;
    expect(component.drawBackdrops).toBe(true);
    component.drawBackdrops = false;
    expect(entity.drawBackdrops).toBe(false);
  });
});
