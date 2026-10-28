import { BitMask, CollisionGroup, Frame3d, IEntity, Point3, Point4, Shape3DDescriptor } from '@gg-web-engine/core';
import { AmmoWorldComponent } from './ammo-world.component';
import Ammo from '../ammo.js/ammo';
import { AmmoGgWorld } from '../types';

export abstract class AmmoBodyComponent<T extends Ammo.btCollisionObject> {
  public static nativeBodyReverseMap: Map<number, AmmoBodyComponent<any>> = new Map<number, AmmoBodyComponent<any>>();

  private static _scratchVector: Ammo.btVector3 | null = null;
  private static _scratchQuaternion: Ammo.btQuaternion | null = null;

  /**
   * One shared `btVector3` for passing a value into a native call that copies it (`setOrigin`,
   * `setLinearVelocity`, ...). Setters run every tick for a moving body, and a `new Ammo.btVector3`
   * per call is never freed by the garbage collector - it piles up in the WASM heap until
   * `Aborted(OOM)`. Never hold on to it: the next setter call overwrites it.
   */
  protected static scratchVector(x: number, y: number, z: number): Ammo.btVector3 {
    if (!AmmoBodyComponent._scratchVector) {
      AmmoBodyComponent._scratchVector = new Ammo.btVector3();
    }
    AmmoBodyComponent._scratchVector.setValue(x, y, z);
    return AmmoBodyComponent._scratchVector;
  }

  /** `btQuaternion` counterpart of {@link scratchVector}. */
  protected static scratchQuaternion(q: Point4): Ammo.btQuaternion {
    if (!AmmoBodyComponent._scratchQuaternion) {
      AmmoBodyComponent._scratchQuaternion = new Ammo.btQuaternion(0, 0, 0, 1);
    }
    AmmoBodyComponent._scratchQuaternion.setValue(q.x, q.y, q.z, q.w);
    return AmmoBodyComponent._scratchQuaternion;
  }

  public get position(): Point3 {
    const origin = this.nativeBody.getWorldTransform().getOrigin();
    return { x: origin.x(), y: origin.y(), z: origin.z() };
  }

  public set position(value: Point3) {
    const transform = this.nativeBody.getWorldTransform();
    transform.setOrigin(AmmoBodyComponent.scratchVector(value.x, value.y, value.z));
    this.applyWorldTransform(transform);
  }

  public get rotation(): Point4 {
    const quaternion = this.nativeBody.getWorldTransform().getRotation();
    return { x: quaternion.x(), y: quaternion.y(), z: quaternion.z(), w: quaternion.w() };
  }

  public set rotation(value: Point4) {
    const transform = this.nativeBody.getWorldTransform();
    transform.setRotation(AmmoBodyComponent.scratchQuaternion(value));
    this.applyWorldTransform(transform);
  }

  /**
   * Moves the body to `transform` (this body's own, already modified, world transform object) -
   * what the `position`/`rotation` setters end with. Body types that keep more than one transform
   * in sync override it (see `AmmoRigidBodyComponent`).
   */
  protected applyWorldTransform(transform: Ammo.btTransform): void {
    this.nativeBody.setWorldTransform(transform);
    this.nativeBody.activate(true);
  }

  /**
   * Frame switch (`Gg3dWorld.switchFrame`): moves the collision object by `delta` without waking it
   * or touching anything else (the base version, for the ghost objects of triggers and character
   * controllers; rigid bodies override it). A ghost object keeps its overlapping pairs: everything
   * moves together, so the next broadphase pass finds the same pairs. Its AABB is updated at once
   * (`updateSingleAabb`) - nothing else would before the next step, and a query (a raycast, a
   * character's sweep) made before it would find the object where it was.
   */
  public onFrameSwitch(delta: Frame3d): void {
    this.moveTransformByFrame(this.nativeBody.getWorldTransform(), delta);
    this.nativeBody.setWorldTransform(this.nativeBody.getWorldTransform());
    this.updateAabbInWorld();
  }

  /**
   * Writes `delta` applied to `transform` into it: the origin rotated about +Z and translated, the
   * basis turned by the yaw (`Rz(yaw) * basis`, computed from the basis rows and written back with
   * `setFromOpenGLMatrix`). The basis never goes through a quaternion: `getRotation`/`setRotation`
   * re-derive the matrix and perturb its float32 components, which a running simulation amplifies -
   * an identity switch would not be a no-op. (`getBasis().getRow(i)` returns a copy - one temporary
   * shared by every call - so the rows cannot be rewritten in place.)
   */
  protected moveTransformByFrame(transform: Ammo.btTransform, delta: Frame3d): void {
    const origin = transform.getOrigin();
    const position = delta.toGlobalPoint({ x: origin.x(), y: origin.y(), z: origin.z() });
    const basis = transform.getBasis();
    // each `getRow` call returns the same temporary btVector3, so read it before the next call
    const row = (i: number): number[] => {
      const r = basis.getRow(i);
      return [r.x(), r.y(), r.z()];
    };
    const a0 = row(0);
    const a1 = row(1);
    const a2 = row(2);
    const c = Math.cos(delta.yaw);
    const s = Math.sin(delta.yaw);
    const b0 = delta.yaw === 0 ? a0 : [0, 1, 2].map(i => c * a0[i] - s * a1[i]);
    const b1 = delta.yaw === 0 ? a1 : [0, 1, 2].map(i => s * a0[i] + c * a1[i]);
    // column-major: m[4 * column + row]
    transform.setFromOpenGLMatrix([
      b0[0],
      b1[0],
      a2[0],
      0,
      b0[1],
      b1[1],
      a2[1],
      0,
      b0[2],
      b1[2],
      a2[2],
      0,
      position.x,
      position.y,
      position.z,
      1,
    ]);
  }

  /** Refreshes the object's broadphase AABB from its current transform, while it is in the world. */
  protected updateAabbInWorld(): void {
    if (this.addedToWorld) {
      this.world.dynamicAmmoWorld?.updateSingleAabb(this.nativeBody);
    }
  }

  public name: string = '';

  abstract entity: IEntity | null;

  get nativeBody(): T {
    return this._nativeBody;
  }

  set nativeBody(value: T) {
    if (value == this._nativeBody) {
      return;
    }
    AmmoBodyComponent.nativeBodyReverseMap.delete(Ammo.getPointer(this._nativeBody));
    this._nativeBody = value;
    AmmoBodyComponent.nativeBodyReverseMap.set(Ammo.getPointer(value), this);
  }

  protected addedToWorld: boolean = false;
  protected _interactWithCGsMask = BitMask.full(16);
  protected _ownCGsMask = BitMask.full(16);

  get interactWithCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return BitMask.unpack(this._interactWithCGsMask, 16);
  }

  abstract refreshCG(): void;

  set interactWithCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    let mask;
    if (value === 'all') {
      mask = BitMask.full(16);
    } else {
      mask = BitMask.pack(value, 16);
    }
    if (this._interactWithCGsMask !== mask) {
      this._interactWithCGsMask = mask;
      if (this.addedToWorld) {
        this.refreshCG();
      }
    }
  }

  get ownCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return BitMask.unpack(this._ownCGsMask, 16);
  }

  set ownCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    let mask;
    if (value === 'all') {
      mask = BitMask.full(16);
    } else {
      mask = BitMask.pack(value, 16);
    }
    if (this._ownCGsMask !== mask) {
      this._ownCGsMask = mask;
      if (this.addedToWorld) {
        this.refreshCG();
      }
    }
  }

  protected constructor(
    protected readonly world: AmmoWorldComponent,
    protected _nativeBody: T,
    public readonly shape: Shape3DDescriptor,
  ) {
    AmmoBodyComponent.nativeBodyReverseMap.set(Ammo.getPointer(this.nativeBody), this);
    this.ownCollisionGroups = this.interactWithCollisionGroups = [world.mainCollisionGroup];
  }

  abstract clone(): AmmoBodyComponent<T>;

  addToWorld(world: AmmoGgWorld): void {
    if (world.physicsWorld != this.world) {
      throw new Error(
        "Ammo bodies cannot be shared between different worlds: this one was created by another world's factory. " +
          'Create it with the factory of the world it is added to (`world.physicsWorld.factory`).',
      );
    }
    this.addedToWorld = true;
    this.world.added$.next(this as any);
  }

  removeFromWorld(world: AmmoGgWorld, dispose: boolean = false): void {
    if (world.physicsWorld != this.world) {
      throw new Error(
        "Ammo bodies cannot be shared between different worlds: this one was created by another world's factory. " +
          'Create it with the factory of the world it is added to (`world.physicsWorld.factory`).',
      );
    }
    this.addedToWorld = false;
    this.world.removed$.next(this as any);
    if (dispose) {
      this.dispose();
    }
  }

  /**
   * Set by the first `dispose()`. `Ammo.destroy` on an already-destroyed object doesn't throw in
   * this build: it runs the native destructor again (a double free), so every `dispose()` in this
   * package returns early once this is set.
   */
  protected nativeDisposed: boolean = false;

  dispose(): void {
    if (this.nativeDisposed) {
      return;
    }
    this.nativeDisposed = true;
    try {
      Ammo.destroy(this.nativeBody);
    } catch {
      // pass
    }
    AmmoBodyComponent.nativeBodyReverseMap.delete(Ammo.getPointer(this.nativeBody));
  }
}
