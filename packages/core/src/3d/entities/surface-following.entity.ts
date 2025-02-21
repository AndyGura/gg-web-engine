import { takeUntil } from 'rxjs';
import { BodyOptions, CollisionGroup, IEntity, Pnt2, Pnt3, Point3, Point4, Qtrn, TickOrder } from '../../base';
import { Gg3dWorld, PhysicsTypeDocRepo3D, VisualTypeDocRepo3D } from '../gg-3d-world';
import { Shape3DDescriptor } from '../models/shapes';

export type SurfaceFollowFunc = (p: Point3) => { position: Point3; normal: Point3 };

export class SurfaceFollowingEntity<PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D> extends IEntity<
  Point3,
  Point4,
  VisualTypeDocRepo3D,
  PTypeDoc
> {
  readonly tickOrder = TickOrder.PHYSICS_SIMULATION - 1;

  readonly debugBodySettings: SurfaceFollowingEntityDebugSettings = new SurfaceFollowingEntityDebugSettings();

  constructor(
    public followFunc: SurfaceFollowFunc,
    protected bodyOptions: Partial<
      Omit<BodyOptions, 'dynamic' | 'mass' | 'ownCollisionGroups' | 'interactWithCollisionGroups'>
    > = {},
  ) {
    super();
  }

  private colliders: Map<
    PTypeDoc['rigidBody'],
    [CollisionGroup, PTypeDoc['rigidBody'], { lastDebugStartPos?: Point3; lastDebugSettingsRev?: number }] | null
  > = new Map<PTypeDoc['rigidBody'], [CollisionGroup, PTypeDoc['rigidBody'], { lastDebugStartPos?: Point3 }] | null>();

  private setupCollider(collider: PTypeDoc['rigidBody']) {
    if (!this.world) {
      throw new Error('Cannot setup collider if not added to the world');
    }
    let cg = this.world.physicsWorld.registerCollisionGroup();
    collider.ownCollisionGroups = [...collider.ownCollisionGroups, cg];
    collider.interactWithCollisionGroups = [...collider.ownCollisionGroups, cg];
    let plane = this.world.physicsWorld.factory.createRigidBody({
      shape: { shape: 'PLANE' },
      body: {
        ...this.bodyOptions,
        dynamic: false,
        ownCollisionGroups: [cg],
        interactWithCollisionGroups: [cg],
      },
    })!;
    if (this.debugBodySettings.customGlobalShape) {
      plane.debugBodySettings.shape = { shape: 'SPHERE', radius: 0.25 };
    } else {
      plane.debugBodySettings.ignoreTransform = true;
    }
    this.addComponents(plane);
    this.colliders.set(collider, [cg, plane, {}]);
  }

  addCollider(collider: PTypeDoc['rigidBody']) {
    if (this.world) {
      this.setupCollider(collider);
    } else {
      this.colliders.set(collider, null);
    }
  }

  removeCollider(collider: PTypeDoc['rigidBody']) {
    if (!this.colliders.has(collider)) {
      return;
    }
    const item = this.colliders.get(collider);
    if (item) {
      const [cg, plane] = item;
      this.removeComponents([plane], true);
      collider.ownCollisionGroups = collider.ownCollisionGroups.filter(g => g != cg);
      collider.interactWithCollisionGroups = collider.interactWithCollisionGroups.filter(g => g != cg);
      this.world!.physicsWorld.deregisterCollisionGroup(cg);
    }
    this.colliders.delete(collider);
  }

  onSpawned(world: Gg3dWorld<VisualTypeDocRepo3D, PTypeDoc>) {
    super.onSpawned(world);
    for (const [collider] of this.colliders.entries()) {
      this.setupCollider(collider);
    }
    world.physicsWorld.removed$.pipe(takeUntil(this.onRemoved$)).subscribe(c => {
      if (this.colliders.has(c)) {
        this.removeCollider(c);
      }
    });
    this.tick$.pipe(takeUntil(this.onRemoved$)).subscribe(() => {
      this.positionPlanes();
      this.updateDebugView();
    });
    this.positionPlanes();
    this.updateDebugView();
  }

  private customGlobalDebugDummyBody: PTypeDoc['rigidBody'] | null = null;

  private updateDebugView() {
    const updateDebugView = !!this.world!.renderers.find(r => r.physicsDebugViewActive);
    if (updateDebugView) {
      if (this.debugBodySettings.customGlobalShape) {
        if (!this.customGlobalDebugDummyBody) {
          this.customGlobalDebugDummyBody = this.world!.physicsWorld.factory.createRigidBody({
            shape: { shape: 'BOX', dimensions: Pnt3.O },
            body: { dynamic: false },
          });
          this.customGlobalDebugDummyBody.ownCollisionGroups = [];
          this.customGlobalDebugDummyBody.interactWithCollisionGroups = [];
          this.customGlobalDebugDummyBody.debugBodySettings.type = { type: 'RIGID_STATIC' };
          this.customGlobalDebugDummyBody.debugBodySettings.shape = this.debugBodySettings.customGlobalShape;
          this.addComponents(this.customGlobalDebugDummyBody);
          for (const item of this.colliders.values()) {
            if (item) {
              let [_, plane] = item;
              plane.debugBodySettings.shape = { shape: 'SPHERE', radius: 0.25 };
              plane.debugBodySettings.ignoreTransform = false;
            }
          }
        } else {
          this.customGlobalDebugDummyBody.debugBodySettings.shape = this.debugBodySettings.customGlobalShape;
        }
      } else {
        if (this.customGlobalDebugDummyBody) {
          this.removeComponents([this.customGlobalDebugDummyBody], true);
          this.customGlobalDebugDummyBody = null;
          // reset caches
          for (const item of this.colliders.values()) {
            if (item) {
              item[2] = {};
            }
          }
        }
        for (const [collider, item] of this.colliders.entries()) {
          let [_, plane, debugCache] = item!;
          const { position, normal } = this.followFunc(collider.position);
          let xThreshold = this.debugBodySettings.hexMeshStepDistance;
          let yThreshold = this.debugBodySettings.hexMeshStepDistance * Math.sqrt(3);
          let zThreshold = this.debugBodySettings.hexMeshStepDistance * 2;
          let hexMeshStartPosition = {
            x: Math.round(position.x / xThreshold) * xThreshold,
            y: Math.round(position.y / yThreshold) * yThreshold,
            z: Math.round(position.z / zThreshold) * zThreshold,
          };
          if (
            debugCache.lastDebugSettingsRev != this.debugBodySettings.revision ||
            !debugCache.lastDebugStartPos ||
            Pnt3.dist(debugCache.lastDebugStartPos, hexMeshStartPosition) > 1
          ) {
            let { vertices, faces } = buildHexMeshAlongSurface(
              hexMeshStartPosition,
              this.followFunc,
              this.debugBodySettings.hexMeshDepth,
              this.debugBodySettings.hexMeshStepDistance,
            );
            plane.debugBodySettings.shape = {
              shape: 'MESH',
              vertices,
              faces,
            };
            plane.debugBodySettings.ignoreTransform = true;
            debugCache.lastDebugStartPos = hexMeshStartPosition;
            debugCache.lastDebugSettingsRev = this.debugBodySettings.revision;
          }
        }
      }
    }
  }

  onRemoved() {
    for (const [collider, item] of this.colliders) {
      if (item) {
        const [cg, plane] = item;
        this.removeComponents([plane], true);
        collider.ownCollisionGroups = collider.ownCollisionGroups.filter(g => g != cg);
        collider.interactWithCollisionGroups = collider.interactWithCollisionGroups.filter(g => g != cg);
        this.world!.physicsWorld.deregisterCollisionGroup(cg);
      }
    }
    this.colliders.clear();
    super.onRemoved();
  }

  protected positionPlanes() {
    if (!this.world) {
      return;
    }
    for (const [collider, item] of this.colliders.entries()) {
      let [_, plane] = item!;
      const { position, normal } = this.followFunc(collider.position);
      plane.position = position;
      plane.rotation = Qtrn.lookAt(normal, Pnt3.O);
    }
  }
}

export class SurfaceFollowingEntityDebugSettings {
  private _revision: number = 0;
  public get revision(): number {
    return this._revision;
  }

  get hexMeshStepDistance(): number {
    return this._hexMeshStepDistance;
  }

  set hexMeshStepDistance(value: number) {
    this._hexMeshStepDistance = value;
    this._revision++;
  }

  get hexMeshDepth(): number {
    return this._hexMeshDepth;
  }

  set hexMeshDepth(value: number) {
    this._hexMeshDepth = value;
    this._revision++;
  }

  get customGlobalShape(): Shape3DDescriptor | null {
    return this._customGlobalShape;
  }

  set customGlobalShape(value: Shape3DDescriptor | null) {
    this._customGlobalShape = value;
    this._revision++;
  }

  constructor(
    private _hexMeshStepDistance: number = 4,
    private _hexMeshDepth: number = 6,
    private _customGlobalShape: Shape3DDescriptor | null = null,
  ) {}
}

const buildHexMeshAlongSurface = (
  start: Point3,
  surfaceFunc: SurfaceFollowFunc,
  depth: number,
  stepDistance: number,
): {
  vertices: Point3[];
  faces: [number, number, number][];
} => {
  type PointDescr = { position: Point3; normal: Point3; vertexIndex: number };
  let startPoint = surfaceFunc(start);
  const vertices = [startPoint.position];
  const faces: [number, number, number][] = [];
  let lastLoop: PointDescr[] = [
    {
      position: startPoint.position,
      normal: startPoint.normal,
      vertexIndex: 0,
    },
  ];

  const traverse = (point: { position: Point3; normal: Point3 }, angle: number): Point3 => {
    let pnt2 = Pnt2.rot(Pnt2.scalarMult(Pnt2.X, stepDistance), angle);
    let snorm = Pnt3.toSpherical(point.normal);
    let spnt = Pnt3.toSpherical({ ...pnt2, z: 0 });
    return Pnt3.add(
      point.position,
      Pnt3.fromSpherical({ ...spnt, phi: spnt.phi + Math.cos(snorm.theta - spnt.theta) * snorm.phi }),
    );
  };

  for (let i = 0; i < depth; i++) {
    let newLoop: PointDescr[] = [];
    if (i == 0) {
      for (let j = 0; j < 6; j++) {
        let point = surfaceFunc(traverse(startPoint, (j * Math.PI) / 3));
        newLoop.push({ ...point, vertexIndex: j + 1 });
        faces.push([0, j + 1, j < 5 ? j + 2 : 1]);
      }
    } else {
      for (let j = 0; j < lastLoop.length; j++) {
        let startPoint = lastLoop[j];
        let angle = (Math.floor((j * 6) / lastLoop.length) * Math.PI) / 3;
        let rightNeighbour = lastLoop[j < lastLoop.length - 1 ? j + 1 : 0];
        if (j % (lastLoop.length / 6) == 0) {
          // hex corner vertex, add new vertex in this loop. Each next loop has +6 vertices
          let pointF = surfaceFunc(traverse(startPoint, angle));
          let vi = vertices.length + newLoop.length;
          newLoop.push({ ...pointF, vertexIndex: vi });
          faces.push([startPoint.vertexIndex, j > 0 ? vi - 1 : vi + lastLoop.length + 5, vi]);
        }
        let pointR = surfaceFunc(Pnt3.avg(traverse(startPoint, angle + Math.PI / 3), traverse(rightNeighbour, angle)));
        let vi = vertices.length + newLoop.length;
        newLoop.push({ ...pointR, vertexIndex: vi });
        faces.push([startPoint.vertexIndex, vi - 1, vi]);
        faces.push([rightNeighbour.vertexIndex, startPoint.vertexIndex, vi]);
      }
    }
    vertices.push(...newLoop.map(({ position }) => position));
    lastLoop = newLoop;
  }
  return { vertices, faces };
};
