import {
  BitMask,
  CollisionEvent,
  CollisionGroup,
  IPhysicsWorld3dComponent,
  Pnt3,
  Point3,
  RaycastOptions,
  RaycastResult,
} from '@gg-web-engine/core';
import { Collider, EventQueue, init, Vector3, World } from '@dimforge/rapier3d-compat';
import { Rapier3dRigidBodyComponent } from './rapier-3d-rigid-body.component';
import { Rapier3dTriggerComponent } from './rapier-3d-trigger.component';
import { Rapier3dCharacterControllerComponent } from './rapier-3d-character-controller.component';
import { Rapier3dFactory } from '../rapier-3d-factory';
import { Rapier3dLoader } from '../rapier-3d-loader';
import { Rapier3dPhysicsTypeDocRepo } from '../types';
import { Subject } from 'rxjs';

// bodies that get pushed into `children`/`added$`/`removed$` - see Rapier3dWorldComponent's ctor.
// `handleIdEntityMap` deliberately stays narrower (see Rapier3dCharacterControllerComponent's doc).
type Rapier3dWorldChild = Rapier3dRigidBodyComponent | Rapier3dCharacterControllerComponent;

export class Rapier3dWorldComponent implements IPhysicsWorld3dComponent<Rapier3dPhysicsTypeDocRepo> {
  private _factory: Rapier3dFactory | null = null;
  public get factory(): Rapier3dFactory {
    if (!this._factory) {
      throw new Error('Rapier3d world not initialized');
    }
    return this._factory;
  }

  private _loader: Rapier3dLoader | null = null;
  public get loader(): Rapier3dLoader {
    if (!this._loader) {
      throw new Error('Rapier3d world not initialized');
    }
    return this._loader;
  }

  public readonly added$: Subject<Rapier3dWorldChild> = new Subject();
  public readonly removed$: Subject<Rapier3dWorldChild> = new Subject();
  public readonly children: Rapier3dWorldChild[] = [];

  private _gravity: Point3 = { x: 0, y: 0, z: -9.82 };
  public get gravity(): Point3 {
    return this._gravity;
  }

  public set gravity(value: Point3) {
    this._gravity = value;
    if (this.nativeWorld) {
      this.nativeWorld.gravity.x = value.x;
      this.nativeWorld.gravity.y = value.y;
      this.nativeWorld.gravity.z = value.z;
    }
  }

  readonly mainCollisionGroup: CollisionGroup = 0;

  protected _nativeWorld: World | null = null;
  public get nativeWorld(): World {
    if (!this._nativeWorld) {
      throw new Error('Rapier3d world not initialized');
    }
    return this._nativeWorld;
  }

  private _eventQueue: EventQueue | null = null;
  public get eventQueue(): EventQueue {
    if (!this._eventQueue) {
      throw new Error('Rapier3d world not initialized');
    }
    return this._eventQueue;
  }

  public readonly handleIdEntityMap: Map<number, Rapier3dRigidBodyComponent> = new Map();

  constructor() {
    this.added$.subscribe(c => this.children.push(c));
    this.removed$.subscribe(c => this.children.splice(this.children.indexOf(c), 1));
  }

  async init(): Promise<void> {
    await init();
    this._eventQueue = new EventQueue(true);
    this._nativeWorld = new World(new Vector3(this._gravity.x, this._gravity.y, this._gravity.z));
    this._factory = new Rapier3dFactory(this);
    this._loader = new Rapier3dLoader(this);
  }

  simulate(delta: number): void {
    this._nativeWorld!.timestep = delta / 1000;
    this._nativeWorld?.step(this.eventQueue);
    this.dispatchCollisionEvents();
  }

  /**
   * Drains `eventQueue` exactly once per `simulate()` call and routes each entry to whichever
   * component(s) care - this is the *only* place `drainCollisionEvents` is called for the whole
   * world (see `Rapier3dTriggerComponent.notifyOverlap`'s doc for why a second/independent drain
   * elsewhere would silently steal events from this one). A collider pair with sensor
   * semantics (either side `isSensor()`) is routed as a trigger overlap; an ordinary pair is routed
   * as a real rigid-body collision.
   *
   * `EventQueue.drainCollisionEvents` reports *collider* handles, not rigid-body handles -
   * `handleIdEntityMap` is keyed by rigid-body handle (see `addToWorld`), so each handle is resolved
   * via `World.getCollider(handle)` (returns `null` for a since-removed collider, not a throw - safe
   * to just skip) then `Collider.parent()` to reach the owning `RigidBody` before the map lookup.
   */
  protected dispatchCollisionEvents(): void {
    const nativeWorld = this._nativeWorld;
    if (!nativeWorld) {
      return;
    }
    this.eventQueue.drainCollisionEvents((h1, h2, started) => {
      const collider1 = nativeWorld.getCollider(h1);
      const collider2 = nativeWorld.getCollider(h2);
      if (!collider1 || !collider2) {
        return;
      }
      const body1 = collider1.parent();
      const body2 = collider2.parent();
      if (!body1 || !body2) {
        return;
      }
      const comp1 = this.handleIdEntityMap.get(body1.handle);
      const comp2 = this.handleIdEntityMap.get(body2.handle);
      if (!comp1 || !comp2 || comp1 === comp2) {
        return;
      }

      if (collider1.isSensor() || collider2.isSensor()) {
        if (comp1 instanceof Rapier3dTriggerComponent) {
          comp1.notifyOverlap(comp2, started);
        }
        if (comp2 instanceof Rapier3dTriggerComponent) {
          comp2.notifyOverlap(comp1, started);
        }
        return;
      }

      if (started) {
        const geometry = this.computeContactGeometry(collider1, collider2);
        if (!geometry) {
          return;
        }
        const v1 = body1.linvel();
        const v2 = body2.linvel();
        comp1.notifyCollisionStart({
          otherBody: comp2,
          position: geometry.position,
          normal: geometry.normal,
          relativeVelocity: Pnt3.sub(v2, v1),
          impulse: geometry.impulse,
        });
        comp2.notifyCollisionStart({
          otherBody: comp1,
          position: geometry.position,
          normal: Pnt3.scalarMult(geometry.normal, -1),
          relativeVelocity: Pnt3.sub(v1, v2),
          impulse: geometry.impulse,
        });
      } else {
        comp1.notifyCollisionEnd(comp2);
        comp2.notifyCollisionEnd(comp1);
      }
    });
  }

  /**
   * Reads world-space contact position/normal/impulse for a just-started contact between two
   * non-sensor colliders via `World.contactPair`'s `TempContactManifold`. Returns `null` only if the
   * pair has no manifold at all (shouldn't normally happen for a pair `drainCollisionEvents` just
   * reported as newly touching, but guarded defensively). `World.contactPair`'s callback can in
   * principle be invoked once per manifold between the pair - for the compound/multi-collider shapes
   * this can matter for, each sub-collider pair already gets its own separate `drainCollisionEvents`
   * entry (and thus its own `computeContactGeometry` call) since collision events are per-*collider*,
   * not per-body, so in practice a single call here only ever sees one manifold; only the first
   * encountered is used regardless. `impulse` sums `contactImpulse(i)` across every contact point of
   * that manifold (an already-solved *impulse*, not a force estimate - the pinned
   * `@dimforge/rapier3d-compat` build's constraint solver runs within the same `World.step()` call
   * that produced this `started` event, so the manifold's impulses are already up to date by the time
   * this runs). `normal` is returned oriented "away from `collider1` towards `collider2`" - Rapier's
   * `contactPair(a, b, f)` reports whether its own internally-cached manifold order matches the
   * queried `(a, b)` order via the callback's `flipped` flag; when `flipped` is `true` the manifold's
   * `normal()` (always world-space, always pointing from the manifold's own shape1 to shape2) actually
   * points from `collider2` to `collider1` and must be negated to match this method's documented
   * orientation - verified empirically against a ball resting on a floor below it (see
   * `gg-engine-physics-adapter-rapier` for the exact reproduction).
   */
  protected computeContactGeometry(
    collider1: Collider,
    collider2: Collider,
  ): { position: Point3; normal: Point3; impulse: number } | null {
    const nativeWorld = this._nativeWorld;
    if (!nativeWorld) {
      return null;
    }
    let result: { position: Point3; normal: Point3; impulse: number } | null = null;
    nativeWorld.contactPair(collider1, collider2, (manifold, flipped) => {
      if (result) {
        // only the first manifold is used - see doc above.
        return;
      }
      const rawNormal = manifold.normal();
      const normal: Point3 = flipped
        ? { x: -rawNormal.x, y: -rawNormal.y, z: -rawNormal.z }
        : { x: rawNormal.x, y: rawNormal.y, z: rawNormal.z };

      const numSolverContacts = manifold.numSolverContacts();
      let position: Point3 = Pnt3.O;
      if (numSolverContacts > 0) {
        let sum = Pnt3.O;
        for (let i = 0; i < numSolverContacts; i++) {
          const p = manifold.solverContactPoint(i);
          if (p) {
            sum = Pnt3.add(sum, p);
          }
        }
        position = Pnt3.scalarMult(sum, 1 / numSolverContacts);
      }

      let impulse = 0;
      const numContacts = manifold.numContacts();
      for (let i = 0; i < numContacts; i++) {
        impulse += manifold.contactImpulse(i);
      }

      result = { position, normal, impulse };
    });
    return result;
  }

  protected lockedCollisionGroups: number[] = [];

  registerCollisionGroup(): CollisionGroup {
    for (let i = 1; i < 16; i++) {
      if (!this.lockedCollisionGroups.includes(i)) {
        this.lockedCollisionGroups.push(i);
        return i;
      }
    }
    throw new Error('App tries to register 17th collision group, but rapier 3D supports only 16');
  }

  deregisterCollisionGroup(group: CollisionGroup): void {
    this.lockedCollisionGroups = this.lockedCollisionGroups.filter(x => x !== group);
  }

  raycast(options: RaycastOptions<Point3>): RaycastResult<Point3, Rapier3dRigidBodyComponent> {
    if (!this._nativeWorld) {
      return { hasHit: false };
    }
    const origin = options.from;
    let direction = Pnt3.sub(options.to, options.from);
    const rayLength = Pnt3.len(direction);
    direction = Pnt3.norm(direction);
    const ray = {
      origin: new Vector3(...Pnt3.spr(origin)),
      dir: new Vector3(...Pnt3.spr(direction)),
      pointAt: (t: number) => {
        return new Vector3(origin.x + direction.x * t, origin.y + direction.y * t, origin.z + direction.z * t);
      },
    };
    const mask = (groups?: CollisionGroup[]) => {
      return groups ? BitMask.pack(groups, 16) : BitMask.full(16);
    };
    const hit = this._nativeWorld.castRay(
      ray,
      rayLength,
      true,
      undefined,
      (mask(options.collisionFilterGroups) << 16) | mask(options.collisionFilterMask),
    );
    if (!hit) {
      return { hasHit: false };
    }
    const result: RaycastResult<Point3, Rapier3dRigidBodyComponent> = {
      hasHit: true,
    };
    const collider = hit.collider;
    if (collider) {
      const rigidBody = collider.parent();
      if (!rigidBody) {
        return { hasHit: false };
      }
      result.hitBody = this.handleIdEntityMap.get(rigidBody.handle);
      result.hitDistance = hit.timeOfImpact;
      result.hitPoint = Pnt3.add(origin, Pnt3.scalarMult(direction, hit.timeOfImpact));

      const rayIntersection = hit.collider.castRayAndGetNormal(ray, hit.timeOfImpact, true);
      result.hitNormal = Pnt3.clone(rayIntersection?.normal || Pnt3.O);
    } else {
      result.hasHit = false;
    }
    return result;
  }

  dispose(): void {
    this._nativeWorld?.free();
  }
}
