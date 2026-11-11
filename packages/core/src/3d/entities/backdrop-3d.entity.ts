import { IEntity, Pnt3, Point3, Point4, TickOrder } from '../../base';
import type { Gg3dWorld, Gg3dWorldTypeDocVPatch, VisualTypeDocRepo3D } from '../gg-3d-world';
import { IVisualScene3dComponent } from '../components/rendering/i-visual-scene-3d.component';
import { ICamera3dComponent } from '../components/rendering/i-camera-3d.component';
import { ISceneOwner } from '../interfaces/i-scene-owner';
import { Backdrop3dOpts, DEFAULT_BACKDROP_FRUSTUM, DEFAULT_BACKDROP_SCALE } from '../models/backdrop';
import { Environment3dOpts } from '../models/environment';
import { Frame3d } from '../models/frame-3d';

/** The environment fields a backdrop scene accepts: it never has a `background` of its own. */
export type BackdropEnvironment3dOpts<Tex> = Partial<Pick<Environment3dOpts<Tex>, 'fog' | 'environmentMap'>>;

/**
 * Throws when `environment` sets a `background` (other than `null`) for a backdrop scene: the world has one sky,
 * `world.visualScene.environment.background`, which the renderers draw behind the farthest backdrop.
 * @internal shared by `Backdrop3dEntity.setEnvironment` and `Environment3dEntity`
 */
export function assertNoBackdropBackground(environment: object, who: string): void {
  if ((environment as { background?: unknown }).background != null) {
    throw new Error(
      `${who}: a backdrop has no background of its own. The world's sky (world.visualScene.setEnvironment({ background }), ` +
        'or a top-level "Environment" entity) is drawn behind the farthest backdrop automatically; ' +
        'set only fog and environmentMap on a backdrop',
    );
  }
}

/** Whether a component is a physics body (rigid body, trigger, vehicle, character controller). */
function isPhysicsComponent(c: object): boolean {
  return 'debugBodySettings' in c && 'interactWithCollisionGroups' in c;
}

/** Whether a component is an audio source. */
function isAudioComponent(c: object): boolean {
  return 'fadeTo' in c && 'isVirtual' in c;
}

/**
 * A miniature 3D scene drawn behind the world: mountains on the horizon, a city skyline, a planet
 * in the sky - the 3D counterpart of a 2D `ParallaxLayer` stack (Source engine's "3D skybox").
 *
 * The entity owns a second visual scene of the world's adapter (`ownedScene`, from
 * `world.visualScene.createBackdropScene()`). Entities added as its children (`addChildren`) are
 * ordinary entities of the world - they tick, are named world-wide and found with
 * `getEntityByName` - but their meshes, lights and particle systems draw into `ownedScene` (see
 * `ISceneOwner`). Each renderer of the world draws every backdrop before the world itself, farthest
 * (smallest `scale`) first, clearing depth in between, through a camera of its own
 * (`createCamera`) posed from the renderer's camera (`poseCameraFor`): the world camera's position
 * mapped through `scale`/`anchor`/`anchorInBackdrop`, its rotation and field of view copied, and
 * the rest of its projection (aspect ratio, an adapter's zoom or view offset) copied by the
 * renderer. The world's sky (`environment.background` of the world's scene) is drawn by the
 * farthest backdrop's pass, so backdrop geometry stands in front of it.
 *
 * Content inside a backdrop is authored in backdrop units - what its camera sees: a model exported
 * at 1/16 is placed at 1/16 coordinates, and fog distances and light ranges are 1/16 too. Its fog
 * and environment map are its own (`setEnvironment`, or a child `Environment3dEntity`); it has no
 * background of its own. It holds no physics and no positional audio: `addChildren` refuses an
 * entity carrying either, since they would land in the world's physics or audio scene at the wrong
 * scale. A world frame switch (`Gg3dWorld.switchFrame`) leaves backdrop content where it is: the
 * mapping goes through global coordinates, so the backdrop does not jump.
 *
 * Create one with `world.addBackdrop(options)` (which creates and initializes the scene) or the
 * `"Backdrop"` level class. Removing it removes its subtree; disposing it disposes its scene.
 * @template VTypeDoc - The visual type document repository
 *
 * @example
 * ```ts
 * world.visualScene.setEnvironment({ background: sky }); // the one sky, as always
 * const horizon = await world.addBackdrop(); // 1/16 scale
 * horizon.setEnvironment({ fog: { type: 'LINEAR', color: 0xd9b48a, near: 40, far: 400 } });
 * horizon.addChildren(new Light3dEntity(world.visualScene.factory.createLight({ type: 'DIRECTIONAL', intensity: 3 })));
 * const ring = await world.loader.loadGgGlb('assets/mountain_ring');
 * horizon.addChildren(ring.entity!);
 * ```
 */
export class Backdrop3dEntity<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>
  extends IEntity<Point3, Point4, Gg3dWorldTypeDocVPatch<VTypeDoc>>
  implements ISceneOwner<VTypeDoc>
{
  static readonly entityTypeName: string = 'Backdrop3dEntity';
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;

  /** Backdrop units per main-world meter, see `Backdrop3dOpts.scale`. Live: the next frame uses it. */
  public scale: number;
  /** The global main-world point that maps onto `anchorInBackdrop`, see `Backdrop3dOpts.anchor`. */
  public anchor: Point3;
  /** The backdrop point `anchor` maps onto, see `Backdrop3dOpts.anchorInBackdrop`. */
  public anchorInBackdrop: Point3;
  /** Near and far planes of every camera drawing this backdrop (`createCamera`), in backdrop units. */
  public readonly frustum: Readonly<{ near: number; far: number }>;

  /**
   * @param ownedScene - A scene from `world.visualScene.createBackdropScene()`, initialized
   * (`await scene.init()`) before this entity is added to the world. Owned: disposed with the entity
   * @param options - See `Backdrop3dOpts`
   */
  constructor(
    public readonly ownedScene: IVisualScene3dComponent<VTypeDoc>,
    options: Backdrop3dOpts = {},
  ) {
    super();
    this.scale = options.scale ?? DEFAULT_BACKDROP_SCALE;
    this.anchor = options.anchor ?? Pnt3.O;
    this.anchorInBackdrop = options.anchorInBackdrop ?? Pnt3.O;
    this.frustum = { ...(options.frustum ?? DEFAULT_BACKDROP_FRUSTUM) };
    if (!(this.scale >= 0) || !Number.isFinite(this.scale)) {
      throw new Error(`Backdrop3dEntity: scale must be a finite number >= 0, got ${options.scale}`);
    }
  }

  /**
   * A new camera for drawing this backdrop: perspective, from `ownedScene`'s factory, with `frustum`
   * as its near and far planes. Every renderer of the world keeps one of its own per backdrop -
   * its lens follows that renderer's camera, so renderers sharing one would keep overwriting each
   * other's settings - poses it with `poseCameraFor` right before each draw and disposes it when it
   * stops drawing this backdrop.
   */
  public createCamera(): VTypeDoc['camera'] {
    return this.ownedScene.factory.createPerspectiveCamera({ frustrum: { ...this.frustum } });
  }

  /**
   * Sets this backdrop's own fog and environment map (image-based lighting), in backdrop units.
   * Only the fields present change; `null` clears one.
   * @throws when `environment` has a `background`: the world's sky is drawn behind the farthest
   * backdrop on its own
   */
  public setEnvironment(environment: BackdropEnvironment3dOpts<VTypeDoc['texture']>): void {
    assertNoBackdropBackground(environment, `Backdrop3dEntity "${this.name}"`);
    this.ownedScene.setEnvironment(environment);
  }

  /**
   * Adds entities whose visual components draw into this backdrop's scene. An entity already in the
   * world on its own (a generator that added what it built) is taken out first and comes back as a
   * child, in this backdrop's scene.
   * @throws when an entity (or one of its descendants) has a physics or audio component
   */
  public override addChildren(...entities: IEntity[]): void {
    for (const entity of entities) {
      this.assertBackdropContent(entity);
    }
    for (const entity of entities) {
      if (entity.world && !entity.parent) {
        entity.world.removeEntity(entity);
      }
    }
    super.addChildren(...entities);
  }

  public override onSpawned(world: Gg3dWorld<Gg3dWorldTypeDocVPatch<VTypeDoc>>): void {
    // the subtree may have grown since addChildren checked it
    for (const child of this.children) {
      this.assertBackdropContent(child);
    }
    super.onSpawned(world);
  }

  /**
   * Places `camera`, a renderer's camera for this backdrop (`createCamera`), for drawing it through
   * `mainCamera`, that renderer's camera in the world: the world camera's global position `P`
   * (through `world.frame`) goes to `anchorInBackdrop + scale * (P - anchor)`, its global rotation
   * is copied, and so is its field of view when it differs. Called by the renderer right before it
   * draws this backdrop; the rest of the projection (aspect ratio, and whatever else the adapter's
   * camera has, such as three.js's `zoom` and view offset) is the renderer's business: it copies
   * that from its own camera too, keeping `frustum` as the near and far planes.
   */
  public poseCameraFor(mainCamera: ICamera3dComponent<any>, camera: VTypeDoc['camera']): void {
    const frame = (this.world as Gg3dWorld<any> | null)?.frame ?? Frame3d.IDENTITY;
    const globalPosition = frame.toGlobalPoint(mainCamera.position);
    camera.position = Pnt3.add(
      this.anchorInBackdrop,
      Pnt3.scalarMult(Pnt3.sub(globalPosition, this.anchor), this.scale),
    );
    camera.rotation = frame.toGlobalRotation(mainCamera.rotation);
    if (mainCamera.supportsFov && camera.supportsFov && camera.fov !== mainCamera.fov) {
      camera.fov = mainCamera.fov;
    }
  }

  public override dispose(): void {
    if (this.disposed) {
      return;
    }
    super.dispose();
    this.ownedScene.dispose();
  }

  private assertBackdropContent(entity: IEntity): void {
    for (const component of entity.components) {
      const kind = isPhysicsComponent(component) ? 'physics' : isAudioComponent(component) ? 'audio' : null;
      if (kind) {
        throw new Error(
          `Backdrop3dEntity "${this.name}": entity "${entity.name}" has a ${kind} component. A backdrop is ` +
            `drawn at another scale, so its content can't take part in the world's ${kind}; ` +
            (kind === 'physics'
              ? 'build it without a body (a display-only Entity3d, a model loaded with loadModel)'
              : 'play ambient sound from the world instead'),
        );
      }
    }
    for (const child of entity.children) {
      this.assertBackdropContent(child);
    }
  }
}
