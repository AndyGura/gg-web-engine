import { DebugBody2DSettings, Gg2dWorld, IBodyComponent, Pnt2, Point2, Shape2DDescriptor } from '@gg-web-engine/core';
import { Subscription } from 'rxjs';
import { PixiVisualTypeDocRepo2D } from '../types';
import { Container, Graphics } from 'pixi.js';
import { tabulateArray } from '../utils/tabulate-array';

export class PixiPhysicsDebugView {
  public readonly debugContainer: Container;

  initShape(c: IBodyComponent<Point2, number>) {
    const debugSettings: DebugBody2DSettings = c.debugBodySettings;
    const shape: Shape2DDescriptor = debugSettings.shape;
    let vertices = this.lineSegmentPointsForShape(shape);
    let graphics: Graphics = new Graphics();
    let color = debugSettings.color;
    graphics.clear();
    for (let i = 0; i < vertices.length; i += 2) {
      graphics.moveTo(...Pnt2.spr(vertices[i])).lineTo(...Pnt2.spr(vertices[i + 1]));
    }
    graphics.stroke({ width: 1, color });
    graphics.position.set(...Pnt2.spr(c.position));
    graphics.rotation = c.rotation;
    this.syncMap.set(c, [graphics, debugSettings.revision]);
    this.debugContainer.addChild(graphics);
  }

  constructor(private readonly world: Gg2dWorld<PixiVisualTypeDocRepo2D>) {
    this.debugContainer = new Container();
    for (const c of this.world!.physicsWorld.children) {
      this.initShape(c);
    }
    this.aSub = this.world!.physicsWorld.added$.subscribe(c => this.initShape(c));
    this.rSub = this.world!.physicsWorld.removed$.subscribe(c => {
      const item = this.syncMap.get(c);
      if (item) {
        this.syncMap.delete(c);
        this.debugContainer.removeChild(item[0]);
      }
    });
  }

  public sync() {
    for (const [c, [m, rev]] of this.syncMap.entries()) {
      const debugSettings: DebugBody2DSettings = c.debugBodySettings;
      if (rev !== debugSettings.revision) {
        this.debugContainer.removeChild(m);
        this.initShape(c);
      } else if (!debugSettings.ignoreTransform) {
        m.position.set(...Pnt2.spr(c.position));
        m.rotation = c.rotation;
      }
    }
  }

  private aSub: Subscription | null = null;
  private rSub: Subscription | null = null;
  private syncMap: Map<IBodyComponent<Point2, number>, [Graphics, number]> = new Map();

  private lineSegmentPointsForShape(shape: Shape2DDescriptor): Point2[] {
    if (shape.shape === 'SQUARE') {
      const d = Pnt2.scalarMult(shape.dimensions, 0.5);
      return [
        ...tabulateArray(4, i => ({ x: i % 2 ? d.x : -d.x, y: i < 2 ? d.y : -d.y })),
        ...tabulateArray(4, i => ({ x: i < 2 ? d.x : -d.x, y: i % 2 ? d.y : -d.y })),
        { x: -d.x, y: -d.y },
        { x: d.x, y: d.y },
        { x: -d.x, y: d.y },
        { x: d.x, y: -d.y },
      ];
    } else if (shape.shape === 'CIRCLE') {
      return [
        ...tabulateArray(32, i => ({
          x: shape.radius * Math.sin((Math.floor((i + 1) / 2) * Math.PI) / 8),
          y: shape.radius * Math.cos((Math.floor((i + 1) / 2) * Math.PI) / 8),
        })),
        { x: 0, y: -shape.radius },
        { x: 0, y: shape.radius },
        { x: -shape.radius, y: 0 },
        { x: shape.radius, y: 0 },
      ];
    }
    return [
      { x: -10, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: -10 },
      { x: 0, y: 10 },
    ];
  }

  public dispose() {
    this.debugContainer.destroy();
    this.aSub?.unsubscribe();
    this.rSub?.unsubscribe();
    this.syncMap = new Map();
  }
}
