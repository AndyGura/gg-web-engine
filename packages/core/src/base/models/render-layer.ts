/**
 * Opaque handle for a render layer - the rendering-side analog of `CollisionGroup`. A display
 * object's `renderLayers`-style membership (see `IDisplayObject3dComponent.enableRenderLayer`) and
 * a camera's own render-layer state (the same three methods, inherited via
 * `ICamera3dComponent extends IDisplayObject3dComponent`) are tested against each other the same
 * way collision groups are: an object is rendered by a given camera iff at least one layer is
 * enabled on both sides. Unlike `CollisionGroup` (owned per `IPhysicsWorldComponent`), render
 * layers are owned per `IVisualScene3dComponent` - see `registerRenderLayer`/`deregisterRenderLayer`
 * there.
 */
export type RenderLayer = number;

/**
 * The layer every display object and every camera belongs to/renders by default - nothing needs to
 * opt into it, and nothing currently in this engine (or a fresh app) ever needs to touch it
 * directly. Equivalent to `IPhysicsWorldComponent.mainCollisionGroup`, and to a fresh three.js
 * `Object3D`/`Camera`'s own native default layer (index `0`) - an adapter's `mainRenderLayer` should
 * always report `0` so this constant and `IVisualScene3dComponent.mainRenderLayer` agree without
 * either one needing to be threaded through call sites that only ever mean "the default".
 */
export const MAIN_RENDER_LAYER: RenderLayer = 0;

/**
 * Reserved render layer a `CharacterController3dEntity` permanently tags its own mesh with (see
 * that class's constructor) so `PlayerCharacterController` can hide the character's own body from
 * its own first-person camera specifically, without hiding it from any *other* camera looking at
 * the same scene (a portal's own "looking through" render pass, a third-person spectator camera,
 * ...) - those never need to be told about this layer at all: every camera defaults to rendering
 * every registered layer (see `ICamera3dComponent`'s doc), so only the one camera that should
 * *stop* seeing it ever needs to touch this constant, via `disableRenderLayer`/`enableRenderLayer`.
 *
 * A single shared constant, not one dynamically `registerRenderLayer()`-allocated layer per
 * character, is deliberate: the only realistic case this is used for is "hide *my own* body from
 * *my own* camera", which every `PlayerCharacterController` instance does identically and
 * independently of every other character in the world (a networked remote player's own body is
 * never hidden this way - only the local viewpoint's own character ever sets `hideMesh`) - so
 * nothing actually needs per-instance uniqueness here, and reserving one well-known layer avoids
 * every character needing a world/`visualScene` reference just to allocate one at construction
 * time (this constant can be used immediately, constructor included, before the entity is ever
 * spawned into a world).
 *
 * Reserved at the numerically opposite end from `registerRenderLayer`'s own allocation range (see
 * that method's doc) specifically so an app registering its own layers for unrelated purposes can
 * never collide with this one by chance.
 */
export const SELF_VIEW_HIDDEN_RENDER_LAYER: RenderLayer = 31;
