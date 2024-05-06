import {
  DebugBody2DSettings,
  Gg2dWorld,
  IBodyComponent,
  IRigidBody2dComponent,
  ITrigger2dComponent,
  Pnt2,
  Point2,
  Shape2DDescriptor,
} from '@gg-web-engine/core';
import { Subscription } from 'rxjs';
import { PixiVisualTypeDocRepo2D } from '../types';
import { Container, Graphics } from 'pixi.js';
import { tabulateArray } from '../utils/tabulate-array';

export class PixiPhysicsDebugView {
  public readonly debugContainer: Container;

  constructor(private readonly world: Gg2dWorld<PixiVisualTypeDocRepo2D>) {
    this.debugContainer = new Container();
    const initShape = (c: ITrigger2dComponent | IRigidBody2dComponent) => {
      const debugSettings: DebugBody2DSettings = c.debugBodySettings;
      const shape: Shape2DDescriptor = debugSettings.shape;
      let vertices = this.lineSegmentPointsForShape(shape);
      let graphics: Graphics = new Graphics();
      this.graphicsDraw(graphics, 0xffffff, vertices);
      this.syncMap.set(c, { graphics, color: 0xffffff, vertices });
      this.debugContainer.addChild(graphics);
    };
    for (const c of this.world!.physicsWorld.children) {
      initShape(c);
    }
    this.aSub = this.world!.physicsWorld.added$.subscribe(c => initShape(c));
    this.rSub = this.world!.physicsWorld.removed$.subscribe(c => {
      const x = this.syncMap.get(c);
      if (x) {
        this.syncMap.delete(c);
        this.debugContainer.removeChild(x.graphics);
      }
    });
  }

  private graphicsDraw(graphics: Graphics, color: number, vertices: Point2[]) {
    graphics.clear();
    for (let i = 0; i < vertices.length; i += 2) {
      graphics.moveTo(...Pnt2.spr(vertices[i])).lineTo(...Pnt2.spr(vertices[i + 1]));
    }
    graphics.stroke({ width: 1, color });
  }

  public sync() {
    for (const [c, m] of this.syncMap.entries()) {
      const debugSettings: DebugBody2DSettings = c.debugBodySettings;
      if (!debugSettings.ignoreTransform) {
        m.graphics.position.set(...Pnt2.spr(c.position));
        m.graphics.rotation = c.rotation;
      }
      let color = 0xffffff;
      switch (debugSettings.type) {
        case 'RIGID_DYNAMIC':
          color = debugSettings.sleeping ? 0x0000ff : 0xff0000;
          break;
        case 'RIGID_STATIC':
          color = 0x00ff00;
          break;
        case 'TRIGGER':
          color = 0xffff00;
          break;
      }
      if (color != m.color) {
        m.color = color;
        this.graphicsDraw(m.graphics, m.color, m.vertices);
      }
    }
  }

  private aSub: Subscription | null = null;
  private rSub: Subscription | null = null;
  private syncMap: Map<
    IBodyComponent<Point2, number>,
    {
      graphics: Graphics;
      vertices: Point2[];
      color: number;
    }
  > = new Map();

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
