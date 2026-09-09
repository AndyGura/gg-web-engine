import { filter, pairwise, startWith, takeUntil } from 'rxjs';
import {
  CollisionGroup,
  IEntity,
  KeyboardInput,
  MouseInput,
  MouseInputState,
  Pnt3,
  Point3,
  TickOrder,
} from '../../../../base';
import { Renderer3dEntity } from '../../renderer-3d.entity';
import { Grabbable3dEntity } from '../../grabbable-3d.entity';
import { Gg3dWorld, Gg3dWorldTypeDocRepo } from '../../../gg-3d-world';

/**
 * Options for an `ObjectGrabController`.
 */
export type ObjectGrabControllerOptions = {
  /**
   * Key code that toggles carrying: while empty-handed, picks up whatever `Grabbable3dEntity` the
   * camera is looking at within `maxGrabDistance`; while already holding something, drops it (same
   * as the right mouse button - see `dropHeld`). Default 'KeyE'.
   */
  grabKey: string;
  /** Max raycast distance from the camera that counts as "in reach" to pick something up, in meters. Default 3. */
  maxGrabDistance: number;
  /** Distance in front of the camera the held object is carried at, in meters. Default 1.5. */
  holdDistance: number;
  /** Speed imparted to a thrown object along the camera's forward direction, in m/s. Default 12. */
  throwSpeed: number;
  /**
   * Collision groups excluded from a held object's own `interactWithCollisionGroups` while held -
   * typically the holder's own collision group(s), so a prop carried right in front of the player
   * doesn't jitter against the player's own body. Passed straight through to
   * `Grabbable3dEntity.grab()`. Default `[]` (no exclusion).
   *
   * Give the holder a dedicated collision group for this (e.g.
   * `physicsWorld.registerCollisionGroup()`, assigned to the character's own `ownCollisionGroups`)
   * rather than reading `characterController.ownCollisionGroups` directly and passing that through
   * unchanged - a character left at its default `ownCollisionGroups: 'all'` reports *every*
   * registered collision group there, not just "the player's own", and excluding all of them here
   * leaves the held object colliding with nothing at all (walls included) for as long as it's
   * carried, not just excluding the player.
   *
   * When assigning that dedicated group, **add** it to the holder's `ownCollisionGroups` alongside
   * whatever it already had (typically `physicsWorld.mainCollisionGroup`) rather than replacing it
   * outright - collision-group filtering is bidirectional (each side's own group must appear in the
   * *other* side's `interactWithCollisionGroups` for the two to collide at all), and ordinary level
   * geometry (walls/floor/static props) is usually created with the default
   * `interactWithCollisionGroups: [mainCollisionGroup]`, not `'all'`. A holder whose own group no
   * longer includes `mainCollisionGroup` at all stops colliding with that geometry entirely, not
   * just with the held object - e.g. a player character capsule silently falling through its own
   * level's floor.
   */
  holderCollisionGroups: ReadonlyArray<CollisionGroup>;
};

const DEFAULT_OPTIONS: ObjectGrabControllerOptions = {
  grabKey: 'KeyE',
  maxGrabDistance: 3,
  holdDistance: 1.5,
  throwSpeed: 12,
  holderCollisionGroups: [],
};

/**
 * HL2/Portal-style "use key carries a physics prop" input controller: raycasts from `camera`'s
 * current position/forward direction to find a `Grabbable3dEntity` within `maxGrabDistance`,
 * `grabKey` picks it up (and drops it again if already holding one - a second `grabKey` press is
 * equivalent to the right mouse button), left mouse button throws it forward (`throwSpeed`), right
 * mouse button drops it in place. Mirrors `PlayerCharacterController` in shape (an input-only entity driving a
 * separate physics entity, reading `camera` for aim rather than owning it) - pair the two by
 * passing the same `keyboard`/`mouseInput`/`camera` instances to both, rather than constructing a
 * second `MouseInput`/`KeyboardInput` here, so pointer-lock/focus behavior stays single-sourced.
 *
 * Held-object collision with the world (including other dynamic bodies, and the holder's own body
 * unless excluded via `holderCollisionGroups`) is intentionally left enabled while carried - see
 * `Grabbable3dEntity`'s own doc for why carrying is a velocity spring rather than a rigid
 * attachment. This means a carried prop can be nudged out of position by something it bumps into,
 * or pin against geometry it's pushed into, matching the feel of Source's own physgun rather than
 * a perfectly rigid hold.
 */
export class ObjectGrabController<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> extends IEntity {
  // Must run before physics simulation, so the velocity `heldObject.updateHold()` sets this tick
  // is what actually gets integrated this frame - see `Grabbable3dEntity.updateHold`'s doc.
  public readonly tickOrder = TickOrder.PHYSICS_SIMULATION - 5;

  protected readonly options: ObjectGrabControllerOptions;

  private _heldObject: Grabbable3dEntity<TypeDoc> | null = null;
  /** The object currently being carried, or `null` if empty-handed. */
  public get heldObject(): Grabbable3dEntity<TypeDoc> | null {
    return this._heldObject;
  }

  constructor(
    protected readonly keyboard: KeyboardInput,
    protected readonly mouseInput: MouseInput,
    protected readonly camera: Renderer3dEntity<TypeDoc['vTypeDoc']>,
    options: Partial<ObjectGrabControllerOptions> = {},
  ) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  onSpawned(world: Gg3dWorld<TypeDoc>): void {
    super.onSpawned(world);

    this.keyboard
      .bind(this.options.grabKey)
      .pipe(
        takeUntil(this._onRemoved$),
        filter(down => this.active && down),
      )
      .subscribe(() => (this._heldObject ? this.dropHeld() : this.tryGrab()));

    // Left/right mouse button "just pressed" edges, derived from MouseInput's drag state (there is
    // no dedicated discrete click event on MouseInput itself - see its own doc for why DRAG/
    // DRAG_RIGHT_BUTTON already distinguish which button, set on the underlying pointerdown).
    this.mouseInput.state$
      .pipe(
        takeUntil(this._onRemoved$),
        startWith(MouseInputState.NONE),
        pairwise(),
        filter(() => this.active),
      )
      .subscribe(([previous, current]) => {
        if (current === MouseInputState.DRAG && previous !== MouseInputState.DRAG) {
          this.throwHeld();
        } else if (current === MouseInputState.DRAG_RIGHT_BUTTON && previous !== MouseInputState.DRAG_RIGHT_BUTTON) {
          this.dropHeld();
        }
      });

    this.tick$
      .pipe(
        takeUntil(this._onRemoved$),
        filter(() => this.active),
      )
      .subscribe(([, delta]) => {
        if (this._heldObject) {
          this._heldObject.updateHold(this.holdPoint(), delta / 1000);
          if (!this._heldObject.isHeld) {
            // `updateHold` can force-release on its own (e.g. dragged farther than
            // `maxHoldDistance` - see its doc) - stay in sync so a stale reference here doesn't
            // block the next `tryGrab()` (which no-ops while `_heldObject` is set) or leave
            // `throwHeld()`/`dropHeld()` acting on an object that isn't actually held anymore.
            this._heldObject = null;
          }
        }
      });
  }

  onRemoved(): void {
    this.dropHeld();
    super.onRemoved();
  }

  private get cameraForward(): Point3 {
    // Camera-basis convention (local -Z forward) - see `FreeCameraController`'s identical
    // derivation, not `CharacterController3dEntity`'s (local +Y forward) convention.
    return Pnt3.rot(Pnt3.nZ, this.camera.rotation);
  }

  private holdPoint(): Point3 {
    return Pnt3.add(this.camera.position, Pnt3.scalarMult(this.cameraForward, this.options.holdDistance));
  }

  private tryGrab(): void {
    if (this._heldObject || !this.world?.physicsWorld) {
      return;
    }
    const from = this.camera.position;
    const to = Pnt3.add(from, Pnt3.scalarMult(this.cameraForward, this.options.maxGrabDistance));
    const result = this.world.physicsWorld.raycast({ from, to });
    const entity = result.hasHit ? result.hitBody?.entity : null;
    if (entity instanceof Grabbable3dEntity) {
      this._heldObject = entity as Grabbable3dEntity<TypeDoc>;
      this._heldObject.grab(this.options.holderCollisionGroups);
    }
  }

  private throwHeld(): void {
    if (!this._heldObject) {
      return;
    }
    this._heldObject.throw(Pnt3.scalarMult(this.cameraForward, this.options.throwSpeed));
    this._heldObject = null;
  }

  private dropHeld(): void {
    if (!this._heldObject) {
      return;
    }
    this._heldObject.release();
    this._heldObject = null;
  }
}
