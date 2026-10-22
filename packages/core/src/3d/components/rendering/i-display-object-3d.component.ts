import { IDisplayObjectComponent, Point3, Point4, RenderLayer } from '../../../base';
import { VisualTypeDocRepo3D } from '../../gg-3d-world';

/**
 * Which of a display object's resources `IDisplayObject3dComponent.makeUnique` gives it its own
 * copies of. Each level includes the one before it:
 * - `'materials'`: the materials of every mesh in the object (the usual need: a color, an opacity
 *   or a texture slot changed for one copy of a model only). Geometry and textures stay shared.
 * - `'meshes'`: the geometry as well (vertex data edited per copy, e.g. a mesh re-pivoted or
 *   deformed by hand). Textures stay shared.
 * - `'all'`: the textures too (texture settings - wrapping, filtering, offset/repeat - changed per
 *   copy). The image data itself may still be shared underneath.
 */
export type UniqueResources3d = 'materials' | 'meshes' | 'all';

export interface IDisplayObject3dComponent<
  VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D,
> extends IDisplayObjectComponent<Point3, Point4, VTypeDoc> {
  /**
   * Joins `layer` to this object's own render-layer membership, in addition to whatever it already
   * belongs to (every display object belongs to `MAIN_RENDER_LAYER` alone from construction,
   * mirroring a fresh three.js `Object3D`'s own native default layer) - **and**, since
   * `ICamera3dComponent extends IDisplayObject3dComponent`, the exact same membership concept
   * doubles as "which render layers this camera renders": a camera enabling a layer starts
   * rendering every object that belongs to it, on top of whatever it already rendered.
   *
   * An object is rendered by a given camera iff **any** layer is enabled on both sides - the same
   * "any shared bit" rule `ownCollisionGroups`/`interactWithCollisionGroups` use for collision, see
   * `CollisionGroup`'s own doc. Every camera enables every currently-registered render layer by
   * default (see `ICamera3dComponent`'s own doc) - so registering a new layer and enabling it on
   * one specific object (without touching any camera) already makes that object visible to every
   * *existing* default camera; the camera side of this method only matters for a camera that's been
   * deliberately narrowed with `disableRenderLayer`.
   *
   * **`clone()` copies render-layer membership along with everything else** (three.js's own
   * `Object3D.copy()` copies `.layers.mask` too) - a clone of an object that was narrowed away from
   * `MAIN_RENDER_LAYER` (e.g. a `CharacterController3dEntity`'s own mesh, permanently on
   * `SELF_VIEW_HIDDEN_RENDER_LAYER` instead - see that constant's doc) inherits that same
   * narrowing, and needs `enableRenderLayer(MAIN_RENDER_LAYER)` (or an equivalent explicit reset)
   * called on the clone if it's meant to be ordinarily visible - e.g. a "ghost preview" clone shown
   * in the main scene regardless of where the original is currently tagged.
   */
  enableRenderLayer(layer: RenderLayer): void;

  /** Undoes `enableRenderLayer` - removes `layer` from this object's own render-layer membership
   * (or a camera's own rendered layers), leaving every other currently-enabled layer untouched. */
  disableRenderLayer(layer: RenderLayer): void;

  /** Whether `layer` is currently one of this object's own render layers (or, for a camera, one of
   * the layers it currently renders) - see `enableRenderLayer`'s own doc. */
  isRenderLayerEnabled(layer: RenderLayer): boolean;

  /**
   * Whether this object casts shadows from lights that have `castShadow` on. Setting it applies to
   * the whole object, including every nested part of a loaded model and every child added with
   * `addChild` at that moment; reading it returns the object's own (root) value.
   */
  castShadow: boolean;

  /** Whether shadows cast by other objects are drawn on this object. Applies like `castShadow`. */
  receiveShadow: boolean;

  /** Narrows the inherited `IDisplayObjectComponent.clone()`'s return type back to
   * `IDisplayObject3dComponent` (a 3D clone is always itself a 3D display object) - otherwise every
   * existing call site cloning a `IDisplayObject3dComponent` would widen back to the dimension-
   * agnostic base type and lose access to `enableRenderLayer`/`disableRenderLayer`/
   * `isRenderLayerEnabled` on the result, purely because those three methods didn't exist on the
   * base interface's own declared return type. */
  clone(): IDisplayObject3dComponent<VTypeDoc>;

  /**
   * Gives this object its own copies of the resources `resources` names (see
   * `UniqueResources3d`), in place of any it shares with other objects - so changing them changes
   * this object only. A model from `world.loader` is a `clone()` of a cached original and shares
   * its geometry, materials and textures with every other copy of the same file: recoloring one
   * copy's material recolors them all, until this is called on it (or the load is made with the
   * `unique` option, which calls it on the returned copy).
   *
   * A resource used several times within the object (one material on several meshes) maps to one
   * copy, so the object keeps its own internal sharing. From then on this
   * object owns the copies: `dispose()` frees them, and still never frees what it continues to
   * share, while disposing the source of a clone (the cached original) never touches the copies.
   * Resources this object already owns are kept as they are, so calling it again with the same or
   * a lower level does nothing, and raising the level copies only what is still shared. Children
   * added with `addChild` are part of the object and get copies too. Call it before handing out
   * `clone()`s of this object if those should get the copies: a clone shares whatever its source
   * has at the time.
   * @param resources - What to copy; `'materials'` when omitted
   */
  makeUnique(resources?: UniqueResources3d): void;

  /** Narrows `IDisplayObjectComponent.popChild()`'s return type the same way `clone()` above does,
   * and for the same reason - a child popped off a 3D display object is itself a 3D display object. */
  popChild(name: string): IDisplayObject3dComponent<VTypeDoc> | null;
}
