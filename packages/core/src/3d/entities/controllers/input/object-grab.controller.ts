import { filter, pairwise, startWith, takeUntil } from 'rxjs';
import { IEntity, KeyboardInput, MouseInput, MouseInputState, Pnt3, Point3, TickOrder } from '../../../../base';
import { Renderer3dEntity } from '../../renderer-3d.entity';
import { Grabbable3dEntity } from '../../grabbable-3d.entity';
import { CharacterController3dEntity } from '../../character-controller-3d.entity';
import { Gg3dWorld, Gg3dWorldTypeDocRepo } from '../../../gg-3d-world';
import { characterControllerSelfHitSkip } from './character-controller-self-hit-skip';

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
   * Extra clearance kept, in meters, beyond `holder`'s own capsule (radius and half-height alike)
   * when clamping the hold point away from it - see this class's own doc for why the hold point is
   * clamped there at all. `0` lets the target land right on the holder's surface (the carried object
   * still visibly touches the holder at that point); the default leaves a small visible gap instead.
   * Default 0.3.
   */
  holderExclusionMargin: number;
};

const DEFAULT_OPTIONS: ObjectGrabControllerOptions = {
  grabKey: 'KeyE',
  maxGrabDistance: 3,
  holdDistance: 1.5,
  throwSpeed: 12,
  holderExclusionMargin: 0.3,
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
 * Held-object collision with the rest of the world (other dynamic bodies, static geometry) is
 * intentionally left enabled while carried - see `Grabbable3dEntity`'s own doc for why carrying is a
 * velocity spring rather than a rigid attachment. This means a carried prop can be nudged out of
 * position by something it bumps into, or pin against geometry it's pushed into, matching the feel
 * of Source's own physgun rather than a perfectly rigid hold.
 *
 * **Collision with `holder` specifically is excluded outright**, not left to the physics engine's
 * ordinary group/mask filtering: whenever a `holder` is given, `tryGrab()` adds the held object's
 * `objectBody` to `holder.characterController.ignoredBodies` (removed again by whichever of
 * `throwHeld`/`dropHeld`/the tick loop's self-release handling ends the hold), making the object
 * genuinely invisible to the holder's own collision queries for as long as it's held - see
 * `ICharacterController3dComponent.ignoredBodies`'s doc for why a real per-pair exclusion like this,
 * rather than collision groups, is what the job actually needs: group/mask filtering is incapable of
 * excluding just this one pair while both the holder and the object still need to collide with the
 * rest of the world (almost always true), no matter how the groups are arranged - there used to be a
 * `holderCollisionGroups` option here built on exactly that approach; it never actually worked for
 * that reason and was removed once `ignoredBodies` shipped as the real fix. `Grabbable3dEntity.grab()`
 * still takes its own `ignoreCollisionGroups` parameter directly, for whatever unrelated group
 * exclusion an app might still want while a prop is held - just not as a way to exclude `holder`.
 *
 * **The hold point is additionally clamped away from `holder`'s own capsule** (see
 * `clampAwayFromHolder`) when a `holder` is given, purely to keep a resting/thrown-and-recaught prop
 * from visibly sitting *inside* the holder's own model at the moment it's picked up, before the
 * spring has had a chance to move it - `ignoredBodies` above is what actually keeps the holder's
 * movement from being blocked by (or resonating with) a held prop; this clamp is a cosmetic
 * finishing touch on top of that, not a second line of defense against it.
 *
 * `holder` is `null` for a holder with no capsule to exclude in the first place - e.g. this
 * controller paired with a `FreeCameraController` (a free-flying spectator/debug camera, not a
 * `CharacterController3dEntity`) rather than `PlayerCharacterController`. `ignoredBodies` and the
 * clamp are simply skipped in that case - there's no kinematic capsule for a held prop to block or
 * resonate with in the first place, and nothing here needs the holder to be a physics body at all
 * when it isn't one.
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
    /** The character whose capsule the hold point is kept clear of - see this class's own doc. Pass
     * the same character driven by the paired `PlayerCharacterController`, or `null` if there's no
     * capsule to exclude (e.g. paired with a `FreeCameraController` instead). */
    protected readonly holder: CharacterController3dEntity<TypeDoc> | null,
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
            this.unignoreForHolder(this._heldObject);
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
    const raw = Pnt3.add(this.camera.position, Pnt3.scalarMult(this.cameraForward, this.options.holdDistance));
    return this.clampAwayFromHolder(raw);
  }

  /**
   * Pushes `target` radially out of a cylinder around `holder`'s own capsule (its actual current
   * radius/`centersDistance`, so this tracks live crouch/stand transitions) if it landed inside one,
   * plus `holderExclusionMargin` clearance - see this class's own doc for why this exists (a purely
   * cosmetic finishing touch, not what actually keeps the holder from colliding with a held prop -
   * see `ignoredBodies`/`ignoreForHolder` for that). A cylinder, not the capsule's own rounded caps,
   * is deliberately used as the exclusion volume - simpler, and the margin already covers the
   * difference near the caps.
   *
   * `target` already outside the cylinder (above/below it entirely, or beyond its radius) is
   * returned unchanged. `target` landing on (or extremely close to) the capsule's own central axis -
   * looking almost straight down/up at yourself - has no well-defined outward direction from the
   * axis alone; falls back to the camera's own horizontal forward, then its horizontal right, so the
   * object gets pushed out in front of (or beside) the holder rather than left exactly on the axis.
   *
   * A no-op (returns `target` unchanged) when `holder` is `null` - see this class's own doc for that
   * case.
   */
  /**
   * Radius of a sphere around `holder` guaranteed to clear its capsule in any direction. Assumes
   * `holder` is set. Used both by `clampAwayFromHolder` (the hold point's own exclusion radius) and
   * by `tryGrab()` (as an upper-bound heuristic for "this first hit was probably my own capsule,
   * not a real obstacle" - see that method's own doc).
   */
  private holderClearance(): number {
    const character = this.holder!.characterController;
    return character.radius + character.centersDistance / 2 + this.options.holderExclusionMargin;
  }

  private clampAwayFromHolder(target: Point3): Point3 {
    if (!this.holder) {
      return target;
    }
    const character = this.holder.characterController;
    const up = character.up;
    const holderPos = this.holder.position;
    const toTarget = Pnt3.sub(target, holderPos);
    const alongUp = Pnt3.dot(toTarget, up);
    const keepOutHalfHeight = this.holderClearance();
    if (Math.abs(alongUp) > keepOutHalfHeight) {
      return target;
    }

    const horizontal = Pnt3.sub(toTarget, Pnt3.scalarMult(up, alongUp));
    const horizontalDist = Pnt3.len(horizontal);
    const keepOutRadius = character.radius + this.options.holderExclusionMargin;
    if (horizontalDist >= keepOutRadius) {
      return target;
    }

    let outDir: Point3;
    if (horizontalDist > 1e-6) {
      outDir = Pnt3.scalarMult(horizontal, 1 / horizontalDist);
    } else {
      const horizontalForward = Pnt3.sub(this.cameraForward, Pnt3.scalarMult(up, Pnt3.dot(this.cameraForward, up)));
      const forwardDist = Pnt3.len(horizontalForward);
      if (forwardDist > 1e-6) {
        outDir = Pnt3.scalarMult(horizontalForward, 1 / forwardDist);
      } else {
        // Camera looking almost exactly along `up` too (straight down/up) - its forward has no
        // usable horizontal component either; its right vector reliably does (camera roll aside).
        const cameraRight = Pnt3.rot(Pnt3.X, this.camera.rotation);
        const horizontalRight = Pnt3.sub(cameraRight, Pnt3.scalarMult(up, Pnt3.dot(cameraRight, up)));
        outDir = Pnt3.norm(horizontalRight);
      }
    }

    return Pnt3.add(holderPos, Pnt3.add(Pnt3.scalarMult(outDir, keepOutRadius), Pnt3.scalarMult(up, alongUp)));
  }

  /**
   * A first-person camera sits inside (or right at the surface of) `holder`'s own capsule, so the
   * very first thing a raycast from `camera.position` finds along almost any forward direction is
   * that capsule itself, not whatever's actually being aimed at - `holder.characterController`
   * isn't reliably resolvable back to `holder` from a `RaycastResult` on every adapter either (e.g.
   * `Rapier3dCharacterControllerComponent`'s own doc - its collider is never registered for that),
   * so this can't be told apart from "some other real obstacle" by identity, and `RaycastResult`
   * gives no distance-through-the-shape either: a ray whose origin is already inside a shape reports
   * that shape as hit at distance `0` (Rapier's `castRay(..., solid: true, ...)`, and Ammo's own
   * `rayTest` finding nothing at all for the containing shape and falling back to a distance-`0`
   * overlap probe) rather than the point where it would actually exit - so "retry from where the
   * self-hit exits" has no real value to read a retry start point from on any adapter, and the two
   * adapters aren't even consistent with each other about what a self-hit *is*: Ammo's `rayTest`
   * simply can't see the shape containing its own ray origin, so it transparently reports whatever
   * real object is actually hit beyond it (the common case needs no retry on Ammo at all); Rapier's
   * `solid: true` mode does the opposite and always reports the containing shape at distance `0`,
   * ahead of anything genuinely beyond it - so relying on the first cast to reliably find the *real*
   * target only ever works by accident, and only on Ammo.
   *
   * **First tried starting the ray a fixed `holderClearance()` distance in front of the camera
   * instead of at it** - a worst-case guess at how big the holder's capsule can possibly be in *any*
   * direction (it also accounts for `centersDistance`, the capsule's full half-height, not just its
   * radius). That guess overshoots dramatically for a camera pitched steeply down at something close
   * and small (the common case for a resting prop, which sits well below eye height) - real,
   * reproduced bug: standing close enough to a small grabbable prop resting on a pedestal, the fixed
   * skip flew straight past the prop *and* landed inside the pedestal underneath it, reporting a
   * legitimate hit on the (non-grabbable) pedestal instead of ever reaching the prop.
   *
   * **Then tried a two-pass cast, retrying from the first hit's own point** (whatever it was) plus a
   * small fixed clearance - cast once from the actual `camera.position` first, and only if that
   * missed (or hit something within `holderClearance()`, plausibly the holder's own capsule) retry
   * from just past that hit. This reads right in isolation, but silently assumed the first hit's
   * point marks where the ray *exits* the self-collision shape - which, per this doc's opening
   * paragraph, is never true for a solid/fallback hit at distance `0`: the reported point is just the
   * ray's own origin again. On Rapier specifically (where the first cast *always* reports the
   * containing capsule this way whenever the camera is inside it) the retry's tiny nudge landed the
   * second cast still deep inside the same capsule, which reported the exact same self-hit again -
   * pick-up silently stopped working on Rapier entirely, while appearing to work fine on Ammo (whose
   * `rayTest` never needed the retry to begin with, for the reason given above).
   *
   * **Fixed by computing the escape point geometrically instead of reading it off any raycast
   * result**: cast once from the actual `camera.position` first - if that already lands on a
   * `Grabbable3dEntity`, done, no retry needed (this is what lets a prop close enough to be found
   * before any self-hit would even occur through on Ammo). Otherwise, when the hit is closer than
   * `holderClearance()` could ever put a genuinely different object (given the camera sits on/within
   * the capsule's own axis), retry from `camera.position` skipped forward by
   * `characterControllerSelfHitSkip()` - see that function's own doc for why it sphere-traces the
   * capsule's own exact geometry (rather than a flat `radius` guess, which broke down for a
   * first-person camera pitched down at something close while sitting above the capsule's
   * cylindrical midsection - a real, reproduced regression) or reading anything off the first cast's
   * result. `PlayerCharacterController`'s third-person `cameraCollision` raycast leans on the exact
   * same helper for the identical self-hit problem. A hit farther than `holderClearance()` away is
   * trusted as a real obstacle and left blocking the grab, exactly as before.
   */
  private tryGrab(): void {
    if (this._heldObject || !this.world?.physicsWorld) {
      return;
    }
    const to = Pnt3.add(this.camera.position, Pnt3.scalarMult(this.cameraForward, this.options.maxGrabDistance));
    let result = this.world.physicsWorld.raycast({ from: this.camera.position, to });
    let entity = result.hasHit ? result.hitBody?.entity : null;
    if (
      this.holder &&
      !(entity instanceof Grabbable3dEntity) &&
      result.hasHit &&
      result.hitDistance !== undefined &&
      result.hitDistance < this.holderClearance()
    ) {
      const character = this.holder.characterController;
      const skipDistance = characterControllerSelfHitSkip(
        this.camera.position,
        this.cameraForward,
        this.holder.position,
        character.up,
        character.radius,
        character.centersDistance,
        this.options.maxGrabDistance,
      );
      const from = Pnt3.add(this.camera.position, Pnt3.scalarMult(this.cameraForward, skipDistance));
      result = this.world.physicsWorld.raycast({ from, to });
      entity = result.hasHit ? result.hitBody?.entity : null;
    }
    if (entity instanceof Grabbable3dEntity) {
      this._heldObject = entity as Grabbable3dEntity<TypeDoc>;
      this._heldObject.grab();
      this.ignoreForHolder(this._heldObject);
    }
  }

  /**
   * Adds `obj.objectBody` to `holder.characterController.ignoredBodies` (see that property's own
   * doc) so the holder's own collision queries never treat the object it's currently carrying as an
   * obstacle - a no-op if there's no `holder`, or `obj` has no `objectBody` (impossible in practice -
   * `Grabbable3dEntity`'s constructor requires one - but `objectBody`'s own type is nullable, see
   * `Entity3d`). Always paired with `unignoreForHolder` on the same object before it stops being
   * held, from every path that can end a hold (`throwHeld`/`dropHeld`, and the tick loop's own
   * handling of `updateHold`'s self-release) - not just this class's own drop/throw methods, since
   * leaving a stale entry in `ignoredBodies` would keep a since-dropped, no-longer-special object
   * permanently invisible to the holder's own collision queries.
   */
  private ignoreForHolder(obj: Grabbable3dEntity<TypeDoc>): void {
    if (this.holder && obj.objectBody) {
      this.holder.characterController.ignoredBodies.add(obj.objectBody);
    }
  }

  /** Undoes `ignoreForHolder` - see its own doc. */
  private unignoreForHolder(obj: Grabbable3dEntity<TypeDoc>): void {
    if (this.holder && obj.objectBody) {
      this.holder.characterController.ignoredBodies.delete(obj.objectBody);
    }
  }

  private throwHeld(): void {
    if (!this._heldObject) {
      return;
    }
    this.unignoreForHolder(this._heldObject);
    this._heldObject.throw(Pnt3.scalarMult(this.cameraForward, this.options.throwSpeed));
    this._heldObject = null;
  }

  private dropHeld(): void {
    if (!this._heldObject) {
      return;
    }
    this.unignoreForHolder(this._heldObject);
    this._heldObject.release();
    this._heldObject = null;
  }
}
