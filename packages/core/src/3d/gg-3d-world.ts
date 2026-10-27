import { assertCanvasReusable } from '../base/components/rendering/canvas-reuse';
import {
  assertWorldDimensions,
  BodyType,
  GgConsoleHost,
  GgWorld,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  RendererOptions,
} from '../base';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { isFrameSwitchable } from './interfaces/i-frame-switchable';
import { Gg3dLoader } from './loader';
import { Frame3d, Frame3dLike } from './models/frame-3d';
import { Entity3d } from './entities/entity-3d';
import { BodyShape3DDescriptor } from './models/shapes';
import { IVisualScene3dComponent } from './components/rendering/i-visual-scene-3d.component';
import { Renderer3dEntity } from './entities/renderer-3d.entity';
import { ICamera3dComponent } from './components/rendering/i-camera-3d.component';
import { IRenderer3dComponent } from './components/rendering/i-renderer-3d.component';
import { IPhysicsWorld3dComponent } from './components/physics/i-physics-world-3d.component';
import {
  DisplayObject3dOpts,
  IAudioSource3dComponentFactory,
  IDisplayObject3dComponentFactory,
  IPhysicsBody3dComponentFactory,
} from './factories';
import { IDisplayObject3dComponent } from './components/rendering/i-display-object-3d.component';
import { ILight3dComponent } from './components/rendering/i-light-3d.component';
import { Light3dDescriptor } from './models/lights';
import { Light3dEntity } from './entities/light-3d.entity';
import { IRaycastVehicleComponent } from './components/physics/i-raycast-vehicle.component';
import { IRigidBody3dComponent } from './components/physics/i-rigid-body-3d.component';
import { ITrigger3dComponent } from './components/physics/i-trigger-3d.component';
import { ICharacterController3dComponent } from './components/physics/i-character-controller-3d.component';
import { IAudioScene3dComponent } from './components/audio/i-audio-scene-3d.component';
import { IAudioSource3dComponent } from './components/audio/i-audio-source-3d.component';
import { IDisplayObject3dComponentLoader, IPhysicsBody3dComponentLoader } from './loaders';
import { CharacterController3dEntity } from './entities/character-controller-3d.entity';
import { IEntity } from '../base/entities/i-entity';
import { PlayerCharacterController } from './entities/controllers/input/player-character.controller';
import { Grabbable3dEntity, Grabbable3dEntityOptions } from './entities/grabbable-3d.entity';
import {
  IParticleSystem3dComponent,
  ParticleSystem3dRenderOptions,
} from './components/rendering/i-particle-system-3d.component';
import { ParticleSystem3dEntity, ParticleSystem3dOptions } from './entities/particle-system-3d.entity';

export type VisualTypeDocRepo3D = {
  factory: IDisplayObject3dComponentFactory;
  loader: IDisplayObject3dComponentLoader;
  displayObject: IDisplayObject3dComponent;
  renderer: IRenderer3dComponent;
  rendererExtraOpts: {};
  camera: ICamera3dComponent;
  light: ILight3dComponent;
  particleSystem: IParticleSystem3dComponent;
  /** Adapter-specific particle system options, merged into `ParticleSystem3dRenderOptions` (e.g. a custom material). */
  particleSystemExtraOpts: {};
  texture: unknown;
};

export type PhysicsTypeDocRepo3D = {
  factory: IPhysicsBody3dComponentFactory;
  loader: IPhysicsBody3dComponentLoader;
  rigidBody: IRigidBody3dComponent;
  trigger: ITrigger3dComponent;
  raycastVehicle: IRaycastVehicleComponent;
  characterController: ICharacterController3dComponent;
};

export type AudioTypeDocRepo3D = {
  factory: IAudioSource3dComponentFactory;
  source: IAudioSource3dComponent;
  clip: unknown;
};

export type Gg3dWorldTypeDocRepo = {
  vTypeDoc: VisualTypeDocRepo3D;
  pTypeDoc: PhysicsTypeDocRepo3D;
  aTypeDoc: AudioTypeDocRepo3D;
};
// utility types to create world type doc by defining either vTypeDoc, pTypeDoc or aTypeDoc only
export type Gg3dWorldTypeDocVPatch<VTypeDoc extends VisualTypeDocRepo3D> = Omit<Gg3dWorldTypeDocRepo, 'vTypeDoc'> & {
  vTypeDoc: VTypeDoc;
};
export type Gg3dWorldTypeDocPPatch<PTypeDoc extends PhysicsTypeDocRepo3D> = Omit<Gg3dWorldTypeDocRepo, 'pTypeDoc'> & {
  pTypeDoc: PTypeDoc;
};
export type Gg3dWorldTypeDocAPatch<ATypeDoc extends AudioTypeDocRepo3D> = Omit<Gg3dWorldTypeDocRepo, 'aTypeDoc'> & {
  aTypeDoc: ATypeDoc;
};

export type Gg3dWorldSceneTypeRepo<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> = {
  visualScene: IVisualScene3dComponent<TypeDoc['vTypeDoc']> | null;
  physicsWorld: IPhysicsWorld3dComponent<TypeDoc['pTypeDoc']> | null;
  audioScene: IAudioScene3dComponent<TypeDoc['aTypeDoc']> | null;
};
// utility types to create world scene type doc by defining either visualScene, physicsWorld or audioScene only
export type Gg3dWorldSceneTypeDocVPatch<
  VTypeDoc extends VisualTypeDocRepo3D,
  VS extends IVisualScene3dComponent<VTypeDoc> | null,
> = Omit<Gg3dWorldSceneTypeRepo, 'visualScene'> & { visualScene: VS };
export type Gg3dWorldSceneTypeDocPPatch<
  PTypeDoc extends PhysicsTypeDocRepo3D,
  PW extends IPhysicsWorld3dComponent<PTypeDoc> | null,
> = Omit<Gg3dWorldSceneTypeRepo, 'physicsWorld'> & { physicsWorld: PW };
export type Gg3dWorldSceneTypeDocAPatch<
  ATypeDoc extends AudioTypeDocRepo3D,
  AS extends IAudioScene3dComponent<ATypeDoc> | null,
> = Omit<Gg3dWorldSceneTypeRepo, 'audioScene'> & { audioScene: AS };

// A helper type to build a full type for the world according to installed modules
// Each module provides its type, like "ThreeGgWorld", "Rapier3dGgWorld" or "WebAudioGgWorld"
// Caller code can define type like this: world: TypedGg3dWorld<ThreeGgWorld, AmmoGgWorld, WebAudioGgWorld>
// Important: visual library world comes first, then physics library, then (optionally) audio library.
// The audio slot is resolved by a single `AW extends Gg3dWorld<infer ATD, infer ASTD>` check (both
// inferred together, same as VTD/VSTD and PTD/PSTD above) rather than two separate checks, so
// `ASTD['audioScene']` is provably assignable against `ATD['aTypeDoc']` by Gg3dWorld's own generic
// constraint - inferring them from two independent conditional expressions doesn't type-check,
// since TS has no way to know two separately-inferred type variables came from the same AW.
export type TypedGg3dWorld<
  VW extends Gg3dWorld<any> | null,
  PW extends Gg3dWorld<any> | null,
  AW extends Gg3dWorld<any> | null = null,
> = VW extends Gg3dWorld<infer VTD, infer VSTD> | null
  ? PW extends Gg3dWorld<infer PTD, infer PSTD> | null
    ? AW extends Gg3dWorld<infer ATD, infer ASTD>
      ? Gg3dWorld<
          { vTypeDoc: VTD['vTypeDoc']; pTypeDoc: PTD['pTypeDoc']; aTypeDoc: ATD['aTypeDoc'] },
          { visualScene: VSTD['visualScene']; physicsWorld: PSTD['physicsWorld']; audioScene: ASTD['audioScene'] }
        >
      : Gg3dWorld<
          { vTypeDoc: VTD['vTypeDoc']; pTypeDoc: PTD['pTypeDoc']; aTypeDoc: AudioTypeDocRepo3D },
          {
            visualScene: VSTD['visualScene'];
            physicsWorld: PSTD['physicsWorld'];
            audioScene: IAudioScene3dComponent | null;
          }
        >
    : never
  : never;

/**
 * `W` (a world type such as `ThreeGgWorld`) with a physics world of whichever adapter, known to be
 * there: `world.physicsWorld` is a plain `IPhysicsWorld3dComponent`, never `null`. For an app that
 * picks its physics backend at runtime and so can't name an adapter's world type:
 * `const world: Gg3dWorldWithPhysics<ThreeGgWorld> = new Gg3dWorld({ visualScene, physicsWorld })`.
 */
export type Gg3dWorldWithPhysics<W extends Gg3dWorld<any, any>> =
  W extends Gg3dWorld<infer TD, infer STD>
    ? Gg3dWorld<TD, Omit<STD, 'physicsWorld'> & { physicsWorld: IPhysicsWorld3dComponent<TD['pTypeDoc']> }>
    : never;

/**
 * The root object of a 3D game: a world clock plus one visual scene, one physics world and an
 * optional audio scene, all 3D. Every 3D world is Z-up: `{x, y}` is the ground plane, `+Z` points
 * to the sky (`Pnt3.Z`). Either scene may be left out for a rendering-only or physics-only world.
 * Switching the physics adapter keeps the code compiling and running, but each library simulates in
 * its own way, so masses, friction, vehicles and characters need retuning after a switch.
 *
 * @example
 * ```ts
 * import { Gg3dWorld, Pnt3, Qtrn, TypedGg3dWorld } from '@gg-web-engine/core';
 * import { ThreeGgWorld, ThreeSceneComponent } from '@gg-web-engine/three';
 * import { Rapier3dGgWorld, Rapier3dWorldComponent } from '@gg-web-engine/rapier3d';
 *
 * // the type makes world.visualScene/physicsWorld the adapters' own classes, never null
 * const world: TypedGg3dWorld<ThreeGgWorld, Rapier3dGgWorld> = new Gg3dWorld({
 *   visualScene: new ThreeSceneComponent(),
 *   physicsWorld: new Rapier3dWorldComponent(), // or AmmoWorldComponent from '@gg-web-engine/ammo'
 * });
 * await world.init();
 *
 * const renderer = world.addRenderer(
 *   world.visualScene.factory.createPerspectiveCamera(),
 *   document.getElementById('gg') as HTMLCanvasElement,
 * );
 * renderer.position = { x: 12, y: 12, z: 12 };
 * renderer.rotation = Qtrn.lookAt(renderer.position, Pnt3.O);
 *
 * world.addPrimitiveRigidBody({
 *   shape: { shape: 'BOX', dimensions: { x: 7, y: 7, z: 1 } },
 *   body: { bodyType: 'static' },
 * });
 * world.start();
 * ```
 */
/** What `Gg3dWorld.frameSwitched$` emits. */
export type FrameSwitch = {
  /** The transform applied to the world's content: `frame.inverse().compose(previousFrame)`. */
  readonly delta: Frame3d;
  /** The frame before the switch. */
  readonly previousFrame: Frame3d;
  /** The frame after the switch, now `Gg3dWorld.frame`. */
  readonly frame: Frame3d;
};

export class Gg3dWorld<
  TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo,
  SceneTypeDoc extends Gg3dWorldSceneTypeRepo<TypeDoc> = Gg3dWorldSceneTypeRepo<TypeDoc>,
> extends GgWorld<Point3, Point4, TypeDoc, SceneTypeDoc> {
  public readonly loader: Gg3dLoader<TypeDoc>;

  constructor(args: {
    visualScene?: SceneTypeDoc['visualScene'];
    physicsWorld?: SceneTypeDoc['physicsWorld'];
    audioScene?: SceneTypeDoc['audioScene'];
    maxTickDelta?: number;
    pauseWhenHidden?: boolean;
    fixedPhysicsStep?: number;
    maxPhysicsStepsPerTick?: number;
    /** the world's initial {@link Gg3dWorld.frame}; identity by default */
    frame?: Frame3dLike;
  }) {
    super(assertWorldDimensions('Gg3dWorld', 3, args));
    this.loader = new Gg3dLoader(this);
    this._frame$ = new BehaviorSubject<Frame3d>(args.frame ? Frame3d.from(args.frame) : Frame3d.IDENTITY);
  }

  private readonly _frame$: BehaviorSubject<Frame3d>;

  /**
   * The global placement of this world's local origin: a translation plus a yaw about `+Z`
   * (`global = rotZ(yaw) * local + position`). Everything in the world - physics, rendering,
   * entity positions - lives in local coordinates; the frame only says where that local space sits
   * in a larger, global one, e.g. a section of an open world simulated near the origin. Identity by
   * default, so a world that never sets it has local = global. Pitch and roll are not part of it:
   * they would tilt gravity.
   *
   * Setting it only changes the mapping: no entity moves. It is meant for the moment a world is
   * created (or before its content is placed); {@link switchFrame} changes it while keeping
   * everything's global placement, moving the content instead. Accepts any {@link Frame3dLike}; reads back a
   * {@link Frame3d}. Converting through it: {@link toGlobalPoint}/{@link toLocalPoint},
   * {@link toGlobalDirection}/{@link toLocalDirection}, {@link toGlobalRotation}/{@link toLocalRotation}.
   */
  public get frame(): Frame3d {
    return this._frame$.value;
  }

  public set frame(value: Frame3dLike) {
    const frame = Frame3d.from(value);
    if (!frame.equals(this._frame$.value)) {
      this._frame$.next(frame);
    }
  }

  /**
   * Moves this world into another frame: one rigid transform applied, between two ticks, to
   * everything in it, so that its global placement doesn't change while its local coordinates do.
   * For an open world made of sections each simulated near its own origin: crossing into the next
   * section switches to that section's frame, and whatever outlives the section (the player's car,
   * the camera, ...) carries on near the new origin.
   *
   * The transform is `delta = newFrame.inverse().compose(oldFrame)` (see `Frame3d`): positions are
   * rotated about `+Z` by its yaw, then translated; orientations get the yaw multiplied in front;
   * linear and angular velocities are rotated only. Every entity of the world receives it through
   * `IFrameSwitchable.onFrameSwitch` (children before their parents), then the physics world through
   * its optional `onFrameSwitch`; then `frame` becomes `newFrame` and `frameSwitched$` emits. The
   * camera moves with everything else, so the next rendered frame looks exactly like the previous
   * one, and the simulation carries on as if nothing happened.
   *
   * Called during a world tick before its physics step is done (from an entity ticking before
   * `TickOrder.PHYSICS_SIMULATION`, or from a collision or trigger callback), the switch waits for
   * that step to finish and is applied right after it, before the transforms are bound and the
   * frame is rendered; a second call in the meantime replaces the pending target. Called at any
   * other time, it is applied immediately.
   *
   * Entities without the hook keep their state. While the dev console is loaded
   * (`window.ggstatic`), each such entity class with a `position` and `rotation` is reported once
   * with a console warning.
   *
   * @param newFrame - the frame to switch to (any `Frame3dLike`)
   *
   * @example
   * ```ts
   * // the car crossed into the next section of the map
   * world.switchFrame(nextSection.frame);
   * world.frameSwitched$.subscribe(({ delta }) => {
   *   // app-held world-space state: markers, waypoints, cached positions
   *   waypoints = waypoints.map(p => delta.toGlobalPoint(p));
   * });
   * ```
   */
  public switchFrame(newFrame: Frame3dLike): void {
    const target = Frame3d.from(newFrame);
    if (this.isBeforePhysicsStep) {
      this.pendingFrameSwitch = target;
      return;
    }
    this.pendingFrameSwitch = null;
    this.applyFrameSwitch(target);
  }

  /** The frame a `switchFrame` call made before this tick's physics step will switch to, or `null`. */
  public get pendingFrame(): Frame3d | null {
    return this.pendingFrameSwitch;
  }

  /**
   * Emits after every frame switch (`switchFrame`), once everything in the world has moved: `delta`
   * is the transform that was applied, `previousFrame` and `frame` the frames before and after.
   * App-held world-space state - waypoints, markers, a cached position - maps through `delta`
   * (`toGlobalPoint`, `toGlobalRotation`, `toGlobalDirection`). Completes in `dispose()`.
   */
  public get frameSwitched$(): Observable<FrameSwitch> {
    return this._frameSwitched$.asObservable();
  }

  private pendingFrameSwitch: Frame3d | null = null;
  // entity classes switchFrame already warned about (dev console only)
  private readonly frameSwitchWarnedTypes: Set<string> = new Set();
  private readonly _frameSwitched$: Subject<FrameSwitch> = new Subject<FrameSwitch>();

  protected onPhysicsStepped(): void {
    super.onPhysicsStepped();
    const pending = this.pendingFrameSwitch;
    if (pending) {
      this.pendingFrameSwitch = null;
      this.applyFrameSwitch(pending);
    }
  }

  private applyFrameSwitch(target: Frame3d): void {
    const previousFrame = this._frame$.value;
    const delta = target.inverse().compose(previousFrame);
    // deepest first: a parent that places its children (a vehicle's wheels) has the last word
    const depthOf = (e: IEntity): number => {
      let depth = 0;
      for (let p = e.parent; p; p = p.parent) {
        depth++;
      }
      return depth;
    };
    const entities = this.children.map(e => [e, depthOf(e)] as const).sort((a, b) => b[1] - a[1]);
    const warn = typeof window !== 'undefined' && !!(window as any).ggstatic;
    for (const [entity] of entities) {
      if (isFrameSwitchable(entity)) {
        entity.onFrameSwitch(delta);
      } else if (warn && 'position' in entity && 'rotation' in entity) {
        const typeName = (entity.constructor as typeof IEntity).entityTypeName ?? 'an entity class';
        if (!this.frameSwitchWarnedTypes.has(typeName)) {
          this.frameSwitchWarnedTypes.add(typeName);
          console.warn(
            `Gg3dWorld "${this.name}": ${typeName} has a position but does not implement ` +
              `IFrameSwitchable.onFrameSwitch, so switchFrame left every ${typeName} (e.g. "${entity.name}") ` +
              `where it was while everything else moved.`,
          );
        }
      }
    }
    this.physicsWorld?.onFrameSwitch?.(delta);
    this._frame$.next(target);
    this._frameSwitched$.next({ delta, previousFrame, frame: target });
  }

  /** The current {@link frame} on subscription, then every change. Completes in `dispose()`. */
  public get frame$(): Observable<Frame3d> {
    return this._frame$.asObservable();
  }

  /** Local point → global point, through {@link frame}. */
  public toGlobalPoint(p: Point3): Point3 {
    return this._frame$.value.toGlobalPoint(p);
  }

  /** Global point → local point, through {@link frame}. */
  public toLocalPoint(p: Point3): Point3 {
    return this._frame$.value.toLocalPoint(p);
  }

  /** Local direction (velocity, angular velocity, offset) → global, through {@link frame}: rotation only. */
  public toGlobalDirection(v: Point3): Point3 {
    return this._frame$.value.toGlobalDirection(v);
  }

  /** Global direction (velocity, angular velocity, offset) → local, through {@link frame}: rotation only. */
  public toLocalDirection(v: Point3): Point3 {
    return this._frame$.value.toLocalDirection(v);
  }

  /** Local orientation (quaternion) → global, through {@link frame}. */
  public toGlobalRotation(q: Point4): Point4 {
    return this._frame$.value.toGlobalRotation(q);
  }

  /** Global orientation (quaternion) → local, through {@link frame}. */
  public toLocalRotation(q: Point4): Point4 {
    return this._frame$.value.toLocalRotation(q);
  }

  public dispose(): void {
    try {
      super.dispose();
    } finally {
      this._frame$.complete();
      this._frameSwitched$.complete();
    }
  }

  /**
   * Creates a primitive shape as both a mesh and a rigid body, wraps them in an `Entity3d` and adds
   * it to the world. A missing visual scene or physics world leaves that half out.
   * @param descr - The shape and its body options (`mass`, `bodyType`, friction, ...)
   * @param position - Initial position (Z-up), the origin by default
   * @param rotation - Initial rotation, identity by default
   * @param material - Material of the mesh
   * @returns The entity, already added to the world
   *
   * @example
   * ```ts
   * import { Pnt3, Qtrn } from '@gg-web-engine/core';
   *
   * // a 1 kg ball dropped from 10 m above the origin
   * const ball = world.addPrimitiveRigidBody(
   *   { shape: { shape: 'SPHERE', radius: 0.5 }, body: { mass: 1 } },
   *   Pnt3.scalarMult(Pnt3.Z, 10),
   *   Qtrn.O,
   *   { color: 0xff8800 },
   * );
   * // later: remove it and free its mesh and body
   * world.removeEntity(ball, true);
   * ```
   */
  addPrimitiveRigidBody(
    descr: BodyShape3DDescriptor,
    position: Point3 = Pnt3.O,
    rotation: Point4 = Qtrn.O,
    material: DisplayObject3dOpts<TypeDoc['vTypeDoc']['texture']> = {},
  ): Entity3d<TypeDoc> {
    const entity = new Entity3d<TypeDoc>({
      object3D: this.visualScene?.factory.createPrimitive(descr.shape, material),
      objectBody: this.physicsWorld?.factory.createRigidBody(descr),
    });
    entity.position = position;
    entity.rotation = rotation;
    this.addEntity(entity);
    return entity;
  }

  /**
   * Same as `addPrimitiveRigidBody`, but the returned entity is a `Grabbable3dEntity` - a prop
   * that can be picked up/carried/thrown (see that class and `ObjectGrabController`). `descr.body`
   * must describe a dynamic body (`bodyType: 'dynamic'`) - a static/kinematic prop can't be carried.
   */
  addGrabbablePrimitive(
    descr: BodyShape3DDescriptor,
    position: Point3 = Pnt3.O,
    rotation: Point4 = Qtrn.O,
    material: DisplayObject3dOpts<TypeDoc['vTypeDoc']['texture']> = {},
    grabOptions: Partial<Grabbable3dEntityOptions> = {},
  ): Grabbable3dEntity<TypeDoc> {
    const entity = new Grabbable3dEntity<TypeDoc>(
      {
        object3D: this.visualScene?.factory.createPrimitive(descr.shape, material),
        objectBody: this.physicsWorld?.factory.createRigidBody(descr),
      },
      grabOptions,
    );
    entity.position = position;
    entity.rotation = rotation;
    this.addEntity(entity);
    return entity;
  }

  /**
   * Creates a light (see `Light3dDescriptor`), wraps it in a `Light3dEntity` and adds it to the
   * world. When `target` is given, the light is rotated to shine from `position` towards it, which
   * is what `DIRECTIONAL` and `SPOT` lights normally want.
   */
  addLight(
    descriptor: Light3dDescriptor,
    position: Point3 = Pnt3.O,
    target?: Point3,
  ): Light3dEntity<TypeDoc['vTypeDoc']> {
    if (!this.visualScene) {
      throw new Error(
        "Cannot add a light to a world without a visual scene: pass a `visualScene` (e.g. @gg-web-engine/three's ThreeSceneComponent) to the Gg3dWorld constructor",
      );
    }
    const entity = new Light3dEntity<TypeDoc['vTypeDoc']>(this.visualScene.factory.createLight(descriptor));
    entity.position = position;
    if (target) {
      entity.lookAt(target);
    }
    this.addEntity(entity);
    return entity;
  }

  /**
   * Creates a particle system - its visual component from `renderOptions` (plus the adapter's own
   * extra options, e.g. a custom material) and the simulation from `options` - wraps it in a
   * `ParticleSystem3dEntity` and adds it to the world.
   *
   * @example
   * ```ts
   * // embers rising from a campfire at the origin (3D worlds are Z-up), plus a one-off burst
   * const embers = world.addParticleSystem(
   *   { capacity: 300, blending: 'additive' },
   *   {
   *     rate: 40, // particles per second, while emitting
   *     lifetime: [0.6, 1.2],
   *     size: 0.15,
   *     tint: 0xff8833,
   *     gravity: { x: 0, y: 0, z: 1.5 },
   *     opacityOverLife: [1, 0],
   *   },
   * );
   * embers.position = { x: 0, y: 0, z: 0.2 };
   * embers.emit(40, (p, ctx) => {
   *   p.velocity = { x: ctx.range(-2, 2), y: ctx.range(-2, 2), z: ctx.range(1, 4) };
   * });
   * ```
   */
  addParticleSystem<T = any>(
    renderOptions: ParticleSystem3dRenderOptions<TypeDoc['vTypeDoc']['texture']> &
      Partial<TypeDoc['vTypeDoc']['particleSystemExtraOpts']>,
    options: ParticleSystem3dOptions<T> = {},
  ): ParticleSystem3dEntity<TypeDoc['vTypeDoc'], T> {
    if (!this.visualScene) {
      throw new Error(
        "Cannot add a particle system to a world without a visual scene: pass a `visualScene` (e.g. @gg-web-engine/three's ThreeSceneComponent) to the Gg3dWorld constructor",
      );
    }
    const entity = new ParticleSystem3dEntity<TypeDoc['vTypeDoc'], T>(
      this.visualScene.factory.createParticleSystem(renderOptions),
      options,
    );
    this.addEntity(entity);
    return entity;
  }

  /**
   * Creates a renderer drawing the scene through `camera` onto `canvas`, wraps it in a
   * `Renderer3dEntity` (which is also how the camera is moved) and adds it to the world.
   * @param camera - A camera from `world.visualScene.factory.createPerspectiveCamera()`
   * @param canvas - The canvas to draw on, already in the DOM. One canvas hosts one renderer:
   * disposing the renderer releases its context, so the next world's renderer needs another canvas
   * (`replaceCanvas(canvas)` swaps in a blank copy)
   * @param rendererOptions - Size, background, antialiasing and the adapter's own extra options
   * @returns The renderer entity; set its `position`/`rotation` to move the camera
   * @throws if the world has no visual scene
   * @throws if a renderer drawing on `canvas` was disposed before
   *
   * @example
   * ```ts
   * import { Pnt3, Qtrn } from '@gg-web-engine/core';
   *
   * const renderer = world.addRenderer(
   *   world.visualScene.factory.createPerspectiveCamera({ fov: 70 }),
   *   document.getElementById('gg') as HTMLCanvasElement,
   * );
   * // 3D worlds are Z-up: stand 10 m back on -Y, 3 m up, looking at the origin
   * renderer.position = { x: 0, y: -10, z: 3 };
   * renderer.rotation = Qtrn.lookAt(renderer.position, Pnt3.O);
   * ```
   */
  addRenderer(
    camera: TypeDoc['vTypeDoc']['camera'],
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & TypeDoc['vTypeDoc']['rendererExtraOpts']>,
  ): Renderer3dEntity<TypeDoc['vTypeDoc']> {
    if (!this.visualScene) {
      throw new Error(
        "Cannot add a renderer to a world without a visual scene: pass a `visualScene` (e.g. @gg-web-engine/three's ThreeSceneComponent) to the Gg3dWorld constructor",
      );
    }
    assertCanvasReusable(canvas);
    const entity = new Renderer3dEntity(this.visualScene.createRenderer(camera, canvas, rendererOptions));
    this.addEntity(entity);
    return entity;
  }

  protected registerConsoleCommands(ggstatic: GgConsoleHost) {
    super.registerConsoleCommands(ggstatic);
    ggstatic.registerConsoleCommand(
      this,
      'set_position',
      async (...args: string[]) => {
        const [name, x, y, z] = args;
        if (!name) {
          throw new Error('usage: set_position NAME X Y Z');
        }
        const entity = this.getEntityByName(name);
        if (!('position' in entity)) {
          throw new Error(`Entity "${name}" (${entity.constructor.name}) has no position`);
        }
        if ([x, y, z].some(v => v === undefined || isNaN(+v))) {
          throw new Error('usage: set_position NAME X Y Z');
        }
        (entity as unknown as Entity3d<TypeDoc>).position = { x: +x, y: +y, z: +z };
        return JSON.stringify((entity as unknown as Entity3d<TypeDoc>).position);
      },
      'args: [ string, float, float, float ]; Teleport a named entity to world-space coordinates. ' +
        'Use "entities"/"entity NAME" to find entity names and their current position',
      true,
    );
    ggstatic.registerConsoleCommand(
      this,
      'set_rotation',
      async (...args: string[]) => {
        const [name, ...rest] = args;
        if (!name) {
          throw new Error('usage: set_rotation NAME X Y Z [W]');
        }
        const entity = this.getEntityByName(name);
        if (!('rotation' in entity)) {
          throw new Error(`Entity "${name}" (${entity.constructor.name}) has no rotation`);
        }
        const nums = rest.map(Number);
        if (nums.length !== 3 && nums.length !== 4) {
          throw new Error('usage: set_rotation NAME X Y Z (euler, radians) OR set_rotation NAME X Y Z W (quaternion)');
        }
        if (nums.some(Number.isNaN)) {
          throw new Error('Wrong arguments');
        }
        const rotation: Point4 =
          nums.length === 4
            ? { x: nums[0], y: nums[1], z: nums[2], w: nums[3] }
            : Qtrn.fromEuler({ x: nums[0], y: nums[1], z: nums[2] });
        (entity as unknown as Entity3d<TypeDoc>).rotation = rotation;
        return JSON.stringify((entity as unknown as Entity3d<TypeDoc>).rotation);
      },
      'args: [ string, float, float, float, float? ]; Rotate a named entity. 3 numbers are euler ' +
        'angles in radians, 4 numbers are a raw quaternion (x y z w)',
      true,
    );
    ggstatic.registerConsoleCommand(
      this,
      'spawn',
      async (...args: string[]) => {
        const [shapeArg, x, y, z, bodyTypeArg] = args;
        if ([x, y, z].some(v => v === undefined || isNaN(+v))) {
          throw new Error(
            'usage: spawn BOX|SPHERE|CYLINDER|CONE|CAPSULE|PLANE X Y Z [bodyType=0|1|2|3|static|dynamic|kinematic_pos|kinematic_vel]',
          );
        }
        let bodyType: BodyType = 'dynamic';
        if (['dynamic', 'static', 'kinematic_pos', 'kinematic_vel'].includes(bodyTypeArg || '')) {
          bodyType = bodyTypeArg as BodyType;
        } else if (bodyTypeArg === '0') {
          bodyType = 'static';
        } else if (bodyTypeArg === '1') {
          bodyType = 'dynamic';
        } else if (bodyTypeArg === '2') {
          bodyType = 'kinematic_pos';
        } else if (bodyTypeArg === '3') {
          bodyType = 'kinematic_vel';
        }
        let shape: BodyShape3DDescriptor['shape'];
        switch ((shapeArg || '').toUpperCase()) {
          case 'BOX':
            shape = { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } };
            break;
          case 'SPHERE':
            shape = { shape: 'SPHERE', radius: 0.5 };
            break;
          case 'CYLINDER':
            shape = { shape: 'CYLINDER', radius: 0.5, height: 1 };
            break;
          case 'CONE':
            shape = { shape: 'CONE', radius: 0.5, height: 1 };
            break;
          case 'CAPSULE':
            shape = { shape: 'CAPSULE', radius: 0.5, centersDistance: 1 };
            break;
          case 'PLANE':
            shape = { shape: 'PLANE' };
            break;
          default:
            throw new Error(`Unknown shape "${shapeArg}". Use BOX|SPHERE|CYLINDER|CONE|CAPSULE|PLANE`);
        }
        const entity = this.addPrimitiveRigidBody({ shape, body: { bodyType } }, { x: +x, y: +y, z: +z });
        return `spawned "${entity.name}" (${shape.shape}) at ${JSON.stringify(entity.position)}`;
      },
      'args: [ BOX|SPHERE|CYLINDER|CONE|CAPSULE|PLANE, float, float, float, ' +
        'bodyType=0|1|2|3|static|dynamic|kinematic_pos|kinematic_vel? ]; Spawn a default-sized ' +
        'primitive rigid body at world-space coordinates, for probing physics. bodyType (last ' +
        'arg) defaults to dynamic (1, falls under gravity); numeric shorthand: 0=static, ' +
        '2=kinematic_pos, 3=kinematic_vel',
      true,
    );
    if (this.physicsWorld) {
      ggstatic.registerConsoleCommand(
        this,
        'gravity',
        async (...args: string[]) => {
          if (args.length == 1) {
            args = ['0', '0', '' + -+args[0]]; // mean -Z axis
          }
          if (args.length > 0) {
            if (isNaN(+args[0]) || isNaN(+args[1]) || isNaN(+args[2])) {
              throw new Error('Wrong arguments');
            }
            this.physicsWorld!.gravity = { x: +args[0], y: +args[1], z: +args[2] };
          }
          return JSON.stringify(this.physicsWorld!.gravity);
        },
        'args: [ ?float, ?float, ?float ]; Get or set 3D world gravity vector. 1 argument sets ' +
          'vector {x: 0, y: 0, z: -value}, 3 arguments set the whole vector.' +
          ' Default value is "9.82" or "0 0 -9.82"',
        true,
      );
      ggstatic.registerConsoleCommand(
        this,
        'player_spawn',
        async (...args: string[]) => {
          const [x, y, z] = args;
          if ([x, y, z].some(v => v === undefined || isNaN(+v))) {
            throw new Error('usage: player_spawn X Y Z');
          }
          const renderer = this.renderers[0] as Renderer3dEntity<TypeDoc['vTypeDoc']> | undefined;
          if (!renderer) {
            throw new Error('Cannot spawn a player without a renderer - call addRenderer first');
          }
          const characterController = this.physicsWorld!.factory.createCharacterController(
            { radius: 0.4, centersDistance: 1.0 },
            { position: { x: +x, y: +y, z: +z } },
          );
          const character = new CharacterController3dEntity<TypeDoc>(
            { radius: 0.4, centersDistance: 1.0 },
            this.visualScene?.factory.createCapsule(0.4, 1.0) ?? null,
            characterController,
          );
          this.addEntity(character);
          const controller = new PlayerCharacterController<TypeDoc>(this.keyboardInput, character, renderer);
          this.addEntity(controller);
          return `spawned "${character.name}" at ${JSON.stringify(character.position)}, controlled by "${controller.name}"`;
        },
        'usage: player_spawn X Y Z; Spawn a default player character (capsule body, WASD/' +
          'arrows movement, mouse-look) at world-space position X Y Z (Z-up, so Z is height off ' +
          "the ground) and control the first renderer's camera with it. Prints the spawned " +
          'controller entity\'s name (the "controlled by" part of the output) - pass that name to ' +
          '"player_mode" to switch it between first/third person',
        true,
      );
      ggstatic.registerConsoleCommand(
        this,
        'player_mode',
        async (...args: string[]) => {
          const [name, mode] = args;
          if (!name || (mode !== 'first-person' && mode !== 'third-person')) {
            throw new Error('usage: player_mode NAME first-person|third-person');
          }
          const controller = this.getEntityByName<PlayerCharacterController<TypeDoc>>(name);
          controller.viewMode = mode;
          return controller.viewMode;
        },
        'usage: player_mode NAME first-person|third-person; Switch the PlayerCharacterController ' +
          'entity named NAME - the controller name printed by "player_spawn" (the "controlled ' +
          'by" part of its output) - between first- and third-person view',
      );
    }
  }
}
