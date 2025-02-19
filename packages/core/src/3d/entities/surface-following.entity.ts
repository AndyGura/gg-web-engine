import { takeUntil } from 'rxjs';
import { CollisionGroup, IEntity, Pnt2, Pnt3, Point3, Point4, Qtrn, TickOrder } from '../../base';
import { Gg3dWorld, PhysicsTypeDocRepo3D, VisualTypeDocRepo3D } from '../gg-3d-world';

export type SurfaceFollowFunc = (p: Point3) => { position: Point3; normal: Point3 };

export class SurfaceFollowingEntity<PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D> extends IEntity<
  Point3,
  Point4,
  VisualTypeDocRepo3D,
  PTypeDoc
> {
  readonly tickOrder = TickOrder.PHYSICS_SIMULATION - 1;

  constructor(public followFunc: SurfaceFollowFunc) {
    super();
  }

  private colliders: Map<
    PTypeDoc['rigidBody'],
    [CollisionGroup, PTypeDoc['rigidBody'], { lastDebugStartPos?: Point3 }] | null
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
      body: { dynamic: false },
    })!;
    plane.ownCollisionGroups = [cg];
    plane.interactWithCollisionGroups = [cg];
    plane.debugBodySettings.ignoreTransform = true;
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
    });
    this.positionPlanes();
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

  readonly debugMeshStepDistance = 4;

  protected positionPlanes() {
    if (!this.world) {
      return;
    }
    const updateDebugView = !!this.world.renderers.find(r => r.physicsDebugViewActive);
    for (const [collider, item] of this.colliders.entries()) {
      let [_, plane, debugCache] = item!;
      const { position, normal } = this.followFunc(collider.position);
      plane.position = position;
      plane.rotation = Qtrn.lookAt(normal, Pnt3.O);
      if (updateDebugView) {
        let xThreshold = this.debugMeshStepDistance;
        let yThreshold = this.debugMeshStepDistance * Math.sqrt(3);
        let zThreshold = this.debugMeshStepDistance * 2;
        let hexMeshStartPosition = {
          x: Math.round(position.x / xThreshold) * xThreshold,
          y: Math.round(position.y / yThreshold) * yThreshold,
          z: Math.round(position.z / zThreshold) * zThreshold,
        };
        if (!debugCache.lastDebugStartPos || Pnt3.dist(debugCache.lastDebugStartPos, hexMeshStartPosition) > 1) {
          let { vertices, faces } = buildHexMeshAlongSurface(
            hexMeshStartPosition,
            this.followFunc,
            6,
            this.debugMeshStepDistance,
          );
          plane.debugBodySettings.shape = {
            shape: 'MESH',
            vertices,
            faces,
          };
          debugCache.lastDebugStartPos = hexMeshStartPosition;
        }
      }
    }
  }
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
        vertices.push(point.position);
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
          let vi = vertices.length;
          vertices.push(pointF.position);
          newLoop.push({ ...pointF, vertexIndex: vi });
          faces.push([startPoint.vertexIndex, j > 1 ? vi - 1 : vi + lastLoop.length + 5, vi]);
        }
        let pointR = surfaceFunc(Pnt3.avg(traverse(startPoint, angle + Math.PI / 3), traverse(rightNeighbour, angle)));
        let vi = vertices.length;
        vertices.push(pointR.position);
        newLoop.push({ ...pointR, vertexIndex: vi });
        faces.push([startPoint.vertexIndex, vi - 1, vi]);
        faces.push([rightNeighbour.vertexIndex, startPoint.vertexIndex, vi]);
      }
    }
    lastLoop = newLoop;
    // TODO remove
    vertices.push(...lastLoop.map(({ position }) => position));
  }
  return { vertices, faces };
};
