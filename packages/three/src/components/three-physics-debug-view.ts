import {
  DebugBody3DSettings,
  Gg3dWorld,
  IBodyComponent,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  Shape3DMeshDescriptor,
} from '@gg-web-engine/core';
import { ThreeRendererComponent } from './three-renderer.component';
import { ThreeVisualTypeDocRepo } from '../types';
import { BufferGeometry, Camera, LineSegments, Mesh, Scene, Vector3, WebGLRenderer } from 'three';
import { tabulateArray } from '../utils/tabulate-array';
import { Subscription } from 'rxjs';

export class ThreePhysicsDebugView {
  private static activeDebugViews: Map<
    Gg3dWorld<ThreeVisualTypeDocRepo>,
    {
      view: ThreePhysicsDebugView;
      renderers: ThreeRendererComponent[];
    }
  > = new Map();

  public static startDebugView(
    world: Gg3dWorld<ThreeVisualTypeDocRepo>,
    renderer: ThreeRendererComponent,
  ): ThreePhysicsDebugView {
    let activeDescr = this.activeDebugViews.get(world);
    if (!activeDescr) {
      activeDescr = {
        view: new ThreePhysicsDebugView(world),
        renderers: [renderer],
      };
      this.activeDebugViews.set(world, activeDescr);
    } else if (!activeDescr.renderers.includes(renderer)) {
      activeDescr.renderers.push(renderer);
    }
    return activeDescr.view;
  }

  public static stopDebugView(debugView: ThreePhysicsDebugView, renderer: ThreeRendererComponent) {
    const world = debugView.world;
    const activeDescr = this.activeDebugViews.get(world);
    if (activeDescr) {
      activeDescr.renderers = activeDescr.renderers.filter(x => x !== renderer);
      if (activeDescr.renderers.length === 0) {
        activeDescr.view.dispose();
        this.activeDebugViews.delete(world);
      }
    }
  }

  initShape(c: IBodyComponent<Point3, Point4>) {
    const debugSettings: DebugBody3DSettings = c.debugBodySettings;
    const shape: Shape3DMeshDescriptor = debugSettings.shape;
    let vertices = this.lineSegmentPointsForShape(shape);
    let m: Mesh;
    if (vertices) {
      m = new LineSegments(new BufferGeometry().setFromPoints(vertices)) as any;
      (m.material as any).color.set(debugSettings.color);
    } else {
      m = this.world?.visualScene.factory.createPrimitive(debugSettings.shape, {
        shading: 'wireframe',
        color: debugSettings.color,
      })!.nativeMesh! as Mesh;
    }
    if (!debugSettings.ignoreTransform) {
      m.position.set(...Pnt3.spr(c.position));
      m.quaternion.set(...Qtrn.spr(c.rotation));
    }
    this.syncMap.set(c, [m, debugSettings.revision]);
    this.debugScene?.add(m);
  }

  private constructor(private readonly world: Gg3dWorld<ThreeVisualTypeDocRepo>) {
    this.debugScene = new Scene();
    for (const c of this.world!.physicsWorld.children) {
      this.initShape(c);
    }
    this.aSub = this.world!.physicsWorld.added$.subscribe(c => this.initShape(c));
    this.rSub = this.world!.physicsWorld.removed$.subscribe(c => {
      const item = this.syncMap.get(c);
      if (item) {
        this.syncMap.delete(c);
        this.debugScene?.remove(item[0]);
      }
    });
  }

  private debugScene: Scene | null = null;

  public get scene(): Scene {
    return this.debugScene!;
  }

  public render(nativeRenderer: WebGLRenderer, nativeCamera: Camera) {
    for (const [c, [m, rev]] of this.syncMap.entries()) {
      const debugSettings: DebugBody3DSettings = c.debugBodySettings;
      if (rev !== debugSettings.revision) {
        this.debugScene?.remove(m);
        this.initShape(c);
      } else if (!debugSettings.ignoreTransform) {
        m.position.set(...Pnt3.spr(c.position));
        m.quaternion.set(...Qtrn.spr(c.rotation));
      }
    }
    const autoClearColor = nativeRenderer.autoClearColor;
    if (autoClearColor) {
      nativeRenderer.autoClearColor = false;
    }
    nativeRenderer.render(this.debugScene!, nativeCamera);
    if (autoClearColor) {
      nativeRenderer.autoClearColor = true;
    }
  }

  private aSub: Subscription | null = null;
  private rSub: Subscription | null = null;
  private syncMap: Map<IBodyComponent<Point3, Point4>, [Mesh, number]> = new Map();

  private lineSegmentPointsForShape(shape: Shape3DMeshDescriptor): Vector3[] | null {
    if (shape.shape === 'BOX') {
      const d = Pnt3.scalarMult(shape.dimensions, 0.5);
      return [
        ...tabulateArray(8, i => new Vector3(i < 4 ? d.x : -d.x, i % 4 < 2 ? d.y : -d.y, i % 2 ? d.z : -d.z)),
        ...tabulateArray(8, i => new Vector3(i % 2 ? d.x : -d.x, i < 4 ? d.y : -d.y, i % 4 < 2 ? d.z : -d.z)),
        ...tabulateArray(8, i => new Vector3(i % 4 < 2 ? d.x : -d.x, i % 2 ? d.y : -d.y, i < 4 ? d.z : -d.z)),
      ];
    } else if (shape.shape === 'CYLINDER') {
      return [
        ...tabulateArray(
          32,
          i =>
            new Vector3(
              shape.radius * Math.sin((Math.floor((i + 1) / 2) * Math.PI) / 8),
              shape.radius * Math.cos((Math.floor((i + 1) / 2) * Math.PI) / 8),
              -shape.height / 2,
            ),
        ),
        ...tabulateArray(
          32,
          i =>
            new Vector3(
              shape.radius * Math.sin((Math.floor((i + 1) / 2) * Math.PI) / 8),
              shape.radius * Math.cos((Math.floor((i + 1) / 2) * Math.PI) / 8),
              shape.height / 2,
            ),
        ),
        ...tabulateArray(
          8,
          i =>
            new Vector3(
              Math.floor(i / 2) % 2 ? 0 : i < 4 ? shape.radius : -shape.radius,
              Math.floor(i / 2) % 2 ? (i < 4 ? shape.radius : -shape.radius) : 0,
              i % 2 ? shape.height / 2 : -shape.height / 2,
            ),
        ),
        new Vector3(0, 0, -shape.height / 2),
        new Vector3(0, 0, shape.height / 2),
      ];
    } else if (shape.shape === 'CONE') {
      return [
        ...tabulateArray(
          32,
          i =>
            new Vector3(
              shape.radius * Math.sin((Math.floor((i + 1) / 2) * Math.PI) / 8),
              shape.radius * Math.cos((Math.floor((i + 1) / 2) * Math.PI) / 8),
              -shape.height / 2,
            ),
        ),
        ...tabulateArray(
          8,
          i =>
            new Vector3(
              i % 2 ? 0 : Math.floor(i / 2) % 2 ? 0 : i < 4 ? shape.radius : -shape.radius,
              i % 2 ? 0 : Math.floor(i / 2) % 2 ? (i < 4 ? shape.radius : -shape.radius) : 0,
              i % 2 ? shape.height / 2 : -shape.height / 2,
            ),
        ),
        new Vector3(0, 0, -shape.height / 2),
        new Vector3(0, 0, shape.height / 2),
      ];
    } else if (shape.shape === 'SPHERE') {
      return [
        ...tabulateArray(
          32,
          i =>
            new Vector3(
              shape.radius * Math.sin((Math.floor((i + 1) / 2) * Math.PI) / 8),
              shape.radius * Math.cos((Math.floor((i + 1) / 2) * Math.PI) / 8),
              0,
            ),
        ),
        ...tabulateArray(
          32,
          i =>
            new Vector3(
              shape.radius * Math.sin((Math.floor((i + 1) / 2) * Math.PI) / 8),
              0,
              shape.radius * Math.cos((Math.floor((i + 1) / 2) * Math.PI) / 8),
            ),
        ),
        ...tabulateArray(
          32,
          i =>
            new Vector3(
              0,
              shape.radius * Math.sin((Math.floor((i + 1) / 2) * Math.PI) / 8),
              shape.radius * Math.cos((Math.floor((i + 1) / 2) * Math.PI) / 8),
            ),
        ),
      ];
    } else if (shape.shape === 'CAPSULE') {
      return [
        ...this.lineSegmentPointsForShape({ shape: 'CYLINDER', radius: shape.radius, height: shape.centersDistance })!,
        ...tabulateArray(
          16,
          i =>
            new Vector3(
              shape.radius * Math.cos((Math.floor((i + 1) / 2) * Math.PI) / 8),
              0,
              shape.radius * Math.sin((Math.floor((i + 1) / 2) * Math.PI) / 8) + shape.centersDistance / 2,
            ),
        ),
        ...tabulateArray(
          16,
          i =>
            new Vector3(
              shape.radius * Math.cos((Math.floor((i + 1) / 2) * Math.PI) / 8),
              0,
              -shape.radius * Math.sin((Math.floor((i + 1) / 2) * Math.PI) / 8) - shape.centersDistance / 2,
            ),
        ),
        ...tabulateArray(
          16,
          i =>
            new Vector3(
              0,
              shape.radius * Math.cos((Math.floor((i + 1) / 2) * Math.PI) / 8),
              shape.radius * Math.sin((Math.floor((i + 1) / 2) * Math.PI) / 8) + shape.centersDistance / 2,
            ),
        ),
        ...tabulateArray(
          16,
          i =>
            new Vector3(
              0,
              shape.radius * Math.cos((Math.floor((i + 1) / 2) * Math.PI) / 8),
              -shape.radius * Math.sin((Math.floor((i + 1) / 2) * Math.PI) / 8) - shape.centersDistance / 2,
            ),
        ),
      ];
    } else if (shape.shape === 'CONVEX_HULL') {
      const tickHalfSize = 0.05;
      return [
        ...shape.vertices
          .map(p => [
            new Vector3(p.x - tickHalfSize, p.y, p.z),
            new Vector3(p.x + tickHalfSize, p.y, p.z),
            new Vector3(p.x, p.y - tickHalfSize, p.z),
            new Vector3(p.x, p.y + tickHalfSize, p.z),
            new Vector3(p.x, p.y, p.z - tickHalfSize),
            new Vector3(p.x, p.y, p.z + tickHalfSize),
          ])
          .reduce((p, c) => {
            p.push(...c);
            return p;
          }, []),
      ];
    } else if (shape.shape === 'COMPOUND') {
      const vertices: Vector3[] = [];
      for (const { position, shape: subShape, rotation } of shape.children) {
        let subShapeVertices = this.lineSegmentPointsForShape(subShape);
        if (!subShapeVertices) {
          return null;
        }
        vertices.push(
          ...subShapeVertices.map(
            v => new Vector3(...Pnt3.spr(Pnt3.add(position || Pnt3.O, Pnt3.rot(v, rotation || Qtrn.O)))),
          ),
        );
      }
      return vertices;
    }
    return null;
  }

  private dispose() {
    this.debugScene = null;
    this.aSub?.unsubscribe();
    this.rSub?.unsubscribe();
    this.syncMap = new Map();
  }
}
