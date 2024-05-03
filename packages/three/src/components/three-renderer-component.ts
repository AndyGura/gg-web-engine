import {
  DebugBody3DSettings,
  Gg3dWorld,
  IBodyComponent,
  IRenderer3dComponent,
  IRigidBody3dComponent,
  ITrigger3dComponent,
  PhysicsTypeDocRepo3D,
  Pnt3,
  Point2,
  Point3,
  Point4,
  Qtrn,
  RendererOptions,
  Shape3DMeshDescriptor,
} from '@gg-web-engine/core';
import {
  BufferGeometry,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { ThreeSceneComponent } from './three-scene.component';
import { ThreeCameraComponent } from './three-camera.component';
import { ThreeVisualTypeDocRepo } from '../types';
import { Subscription } from 'rxjs';
import { tabulateArray } from '../utils/tabulate-array';

export class ThreeRendererComponent extends IRenderer3dComponent<ThreeVisualTypeDocRepo> {
  public readonly nativeRenderer: WebGLRenderer;
  protected world: Gg3dWorld<ThreeVisualTypeDocRepo, PhysicsTypeDocRepo3D, ThreeSceneComponent> | null = null;

  private _physicsDebugViewActive: boolean = false;
  public get physicsDebugViewActive(): boolean {
    return this._physicsDebugViewActive;
  }

  public set physicsDebugViewActive(value: boolean) {
    if (this._physicsDebugViewActive == value) {
      return;
    }
    this._physicsDebugViewActive = value;
    if (this.world) {
      if (value) {
        this.initDebugView();
      } else {
        this.disposeDebugView();
      }
    }
  }

  constructor(
    public readonly scene: ThreeSceneComponent,
    public camera: ThreeCameraComponent,
    public readonly canvas?: HTMLCanvasElement,
    rendererOptions: Partial<RendererOptions> = {},
  ) {
    super(scene, canvas, rendererOptions);
    this.nativeRenderer = new WebGLRenderer({
      canvas,
      antialias: this.rendererOptions.antialias,
      preserveDrawingBuffer: true,
      alpha: this.rendererOptions.transparent,
    });
    this.nativeRenderer.outputColorSpace = SRGBColorSpace;
    this.nativeRenderer.shadowMap.enabled = true;
    this.nativeRenderer.setClearColor(this.rendererOptions.background);
    this.nativeRenderer.shadowMap.type = PCFSoftShadowMap;
    this.nativeRenderer.setPixelRatio(this.rendererOptions.forceResolution || devicePixelRatio);
  }

  addToWorld(world: Gg3dWorld<ThreeVisualTypeDocRepo, PhysicsTypeDocRepo3D, ThreeSceneComponent>) {
    this.world = world;
    if (this.physicsDebugViewActive) {
      this.initDebugView();
    }
  }

  removeFromWorld(world: Gg3dWorld<ThreeVisualTypeDocRepo, PhysicsTypeDocRepo3D, ThreeSceneComponent>) {
    if (this.physicsDebugViewActive) {
      this.disposeDebugView();
    }
    this.world = null;
  }

  resizeRenderer(newSize: Point2): void {
    this.nativeRenderer.setSize(newSize.x, newSize.y);
    if (this.camera.nativeCamera instanceof PerspectiveCamera || this.camera.nativeCamera.type == 'PerspectiveCamera') {
      const newAspect = newSize.x / newSize.y;
      if (Math.abs((this.camera.nativeCamera as PerspectiveCamera).aspect - newAspect) > 0.01) {
        (this.camera.nativeCamera as PerspectiveCamera).aspect = newSize.x / newSize.y;
        (this.camera.nativeCamera as PerspectiveCamera).updateProjectionMatrix();
      }
    }
  }

  render(): void {
    this.nativeRenderer.render(this.scene.nativeScene!, this.camera.nativeCamera);
    if (this.physicsDebugViewActive) {
      for (const [c, m] of this.syncMap.entries()) {
        m.position.set(...Pnt3.spr(c.position));
        m.quaternion.set(...Qtrn.spr(c.rotation));
        if (m.material) {
          const debugSettings: DebugBody3DSettings = c.debugBodySettings;
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
          (m.material as MeshBasicMaterial).color.set(color);
          (m.material as MeshBasicMaterial).needsUpdate = true;
        }
      }
      const autoClearColor = this.nativeRenderer.autoClearColor;
      if (autoClearColor) {
        this.nativeRenderer.autoClearColor = false;
      }
      this.nativeRenderer.render(this.debugScene!, this.camera.nativeCamera);
      if (autoClearColor) {
        this.nativeRenderer.autoClearColor = true;
      }
    }
  }

  dispose(): void {
    this.camera.dispose();
    this.nativeRenderer.clear();
    this.nativeRenderer.dispose();
    this.nativeRenderer.domElement = null as any;
  }

  private debugScene: Scene | null = null;
  private aSub: Subscription | null = null;
  private rSub: Subscription | null = null;
  private syncMap: Map<IBodyComponent<Point3, Point4>, Mesh> = new Map();

  private initDebugView() {
    this.debugScene = new Scene();
    const simplifiedMeshForShape = (shape: Shape3DMeshDescriptor): Vector3[] | null => {
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
          ...simplifiedMeshForShape({ shape: 'CYLINDER', radius: shape.radius, height: shape.centersDistance })!,
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
          let subShapeVertices = simplifiedMeshForShape(subShape);
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
    };
    const initShape = (c: ITrigger3dComponent | IRigidBody3dComponent) => {
      const debugSettings: DebugBody3DSettings = c.debugBodySettings;
      const shape: Shape3DMeshDescriptor = debugSettings.shape;
      let vertices = simplifiedMeshForShape(shape);
      let m: Mesh;
      if (vertices) {
        m = new LineSegments(new BufferGeometry().setFromPoints(vertices)) as any;
      } else {
        m = this.world?.visualScene.factory.createPrimitive(debugSettings.shape, {
          shading: 'wireframe',
          color: 0,
        })!.nativeMesh! as Mesh;
      }
      this.syncMap.set(c, m);
      this.debugScene?.add(m);
    };
    for (const c of this.world!.physicsWorld.children) {
      initShape(c);
    }
    this.aSub = this.world!.physicsWorld.added$.subscribe(c => initShape(c));
    this.rSub = this.world!.physicsWorld.removed$.subscribe(c => {
      const m = this.syncMap.get(c);
      if (m) {
        this.syncMap.delete(c);
        this.debugScene?.remove(m);
      }
    });
  }

  private disposeDebugView() {
    this.debugScene = null;
    this.aSub?.unsubscribe();
    this.rSub?.unsubscribe();
    this.syncMap = new Map();
  }
}
