import {
  Body2DOptions,
  BodyShape2DDescriptor,
  BodyType,
  Pnt2,
  Point2,
  Shape2DDescriptor,
  warnOnce,
} from '@gg-web-engine/core';
import { Bodies, Body, Common, IChamferableBodyDefinition, Vector, Vertices } from 'matter-js';
import * as decomp from 'poly-decomp';
import { MatterRigidBodyComponent } from './components/matter-rigid-body.component';
import { MATTER_INERTIA_SCALE, toMatterLength, toMatterPoint } from './matter-units';

/**
 * `Bodies.fromVertices` (used for the `POLYGON` shape below) only actually decomposes a concave
 * vertex set into convex parts when a decomposition library is registered via `Common.setDecomp` -
 * without it, matter-js silently falls back to the convex hull of the given vertices, so a concave
 * `POLYGON` would render/collide as if it were convex. Registering `poly-decomp` here, once, at
 * module load makes `Bodies.fromVertices` actually decompose concave outlines everywhere it's used.
 */
Common.setDecomp(decomp);

/**
 * `kinematic_pos`/`kinematic_vel`/`ccd` have no native matter-js equivalent at all - unlike
 * `packages/ammo`/`packages/rapier2d`/`packages/rapier3d`, this package can only warn and fall
 * back rather than actually implement either (see `transformOptions`'s own doc). Warned once per
 * distinct message (via core's `warnOnce`) rather than once per body/tick - an app that spawns many
 * kinematic props (or requests `ccd` on many fast-moving bodies) would otherwise flood the console
 * with an identical warning on every single one, which teaches a developer to ignore the console
 * rather than to fix the one call site that needs it.
 */
function warnUnsupportedOnce(message: string): void {
  warnOnce(`[@gg-web-engine/matter] ${message}`);
}

/**
 * Builds a rigid body for `MatterFactory.createRigidBody`. A plain function because building one
 * never needs the world (it's added to one later, in `addToWorld`), which lets
 * `MatterRigidBodyComponent.clone()` rebuild its body from its own shape and options without a
 * factory instance at hand, and without importing the factory module: that module imports
 * `MatterTriggerComponent`, which extends `MatterRigidBodyComponent`, so importing it from the
 * rigid body's own module is a circular import that breaks the `extends`.
 */
export function buildMatterRigidBody(
  descriptor: BodyShape2DDescriptor,
  transform?: {
    position?: Point2;
    rotation?: number;
  },
): MatterRigidBodyComponent {
  // every shape goes through `createShapeParts`, which converts the descriptor's meters into
  // matter-js's native units (see `matter-units.ts`); a single-part shape is used as the body itself
  const nativeBody: Body | null = createShapeBody(descriptor.shape, transformOptions(descriptor.body));
  if (!nativeBody) {
    throw new Error(`Shape "${descriptor.shape}" not implemented for Matter.js`);
  }
  // Must go through `Body.setPosition`/`Body.setAngle` (not a raw `nativeBody.position = ...`
  // field assignment) - see `gg-engine-physics-adapter-matter`'s own note on this: a body's
  // `vertices`/`bounds` (what every actual collision query reads) are only ever translated to
  // match `.position` at creation time, using whatever position was passed into
  // `Bodies.rectangle`/`Bodies.circle`/`Bodies.fromVertices` itself (always `(0, 0)` here) - a
  // later raw field write changes what `.position` *reports* without moving the real collision
  // geometry at all, permanently desyncing the two until something else (ordinary simulation,
  // which this character-controller-adjacent code path can't rely on) happens to correct it.
  const bodyType: BodyType = descriptor.body.bodyType ?? (descriptor.body.mass ? 'dynamic' : 'static');
  if (bodyType === 'dynamic') {
    applyMass(nativeBody, descriptor.body.mass || 1);
  }
  Body.setPosition(nativeBody, toMatterPoint(transform?.position ?? Pnt2.O));
  Body.setAngle(nativeBody, transform?.rotation || 0);
  const component = new MatterRigidBodyComponent(
    nativeBody,
    descriptor.shape,
    bodyType,
    !!descriptor.body.ccd,
    descriptor.body.canSleep !== false,
  );
  // `transformOptions` (used to build `nativeBody` above) only ever reads
  // `bodyType`/`mass`/`restitution`/`friction` - `ownCollisionGroups`/`interactWithCollisionGroups`
  // must be applied through the component's own setters afterward (same as
  // `MatterCharacterControllerComponent`'s constructor already does for a character), or a
  // configured collision group is silently dropped in favor of the "all groups" default every
  // `MatterRigidBodyComponent` otherwise starts with.
  if (descriptor.body.ownCollisionGroups !== undefined) {
    component.ownCollisionGroups = descriptor.body.ownCollisionGroups;
  }
  if (descriptor.body.interactWithCollisionGroups !== undefined) {
    component.interactWithCollisionGroups = descriptor.body.interactWithCollisionGroups;
  }
  return component;
}

/**
 * Sets a dynamic body's mass (kg) and the moment of inertia that goes with it, after the body was
 * built at the origin and before it is moved to its transform. Not `mass` in the `Body.create`
 * options: `Body.create` computes the inertia for the default-density mass first and then applies
 * the `mass` option in the same `Body.set` call as an `inertia` override captured before the mass
 * change, so a body built that way keeps the default-density inertia whatever mass was asked for.
 * `Body.setMass` after creation scales the inertia with the mass, but a compound body's native
 * inertia is the plain sum of its parts' own (`Body.setParts` has no parallel-axis term), so the
 * inertia is recomputed here from every part's vertices about the body's centre of mass, with the
 * mass shared between parts by area, and matter-js's own `_inertiaScale` on top (see
 * `MATTER_INERTIA_SCALE`).
 */
function applyMass(body: Body, mass: number): void {
  const parts = body.parts.length === 1 ? [body] : body.parts.slice(1);
  const partsMass = parts.reduce((sum, part) => sum + part.mass, 0);
  let inertia = 0;
  for (const part of parts) {
    const aboutCentre = part.vertices.map(v => Vector.sub(v, body.position));
    inertia += Vertices.inertia(aboutCentre, (mass * part.mass) / partsMass);
  }
  Body.setMass(body, mass);
  Body.setInertia(body, MATTER_INERTIA_SCALE * inertia);
}

/**
 * The leaf part bodies of `shape`, each built at the local origin in matter-js's native units
 * (every length of the descriptor is meters, converted here - see `matter-units.ts`). A `COMPOUND`
 * is flattened recursively into its leaf parts, each re-homed by its level's `position`/`rotation`.
 */
function createShapeParts(shape: Shape2DDescriptor, options: IChamferableBodyDefinition): Body[] {
  switch (shape.shape) {
    case 'BOX':
      return [Bodies.rectangle(0, 0, toMatterLength(shape.dimensions.x), toMatterLength(shape.dimensions.y), options)];
    case 'CIRCLE':
      return [Bodies.circle(0, 0, toMatterLength(shape.radius), options)];
    case 'CAPSULE':
      return [
        Bodies.rectangle(
          0,
          0,
          toMatterLength(shape.radius * 2),
          toMatterLength(shape.centersDistance + shape.radius * 2),
          {
            ...options,
            chamfer: { radius: toMatterLength(shape.radius) },
          },
        ),
      ];
    case 'CONVEX_HULL':
      return [Bodies.fromVertices(0, 0, [Pnt2.hull(shape.vertices).map(toMatterPoint)], options)];
    case 'POLYGON':
      return [Bodies.fromVertices(0, 0, [shape.vertices.map(toMatterPoint)], options)];
    case 'COMPOUND': {
      const parts: Body[] = [];
      for (const { position, rotation, shape: childShape } of shape.children) {
        const childParts = createShapeParts(childShape, options);
        for (const part of childParts) {
          Body.setPosition(
            part,
            Vector.add(Vector.rotate(part.position, rotation || 0), toMatterPoint(position ?? Pnt2.O)),
          );
          Body.setAngle(part, part.angle + (rotation || 0));
        }
        parts.push(...childParts);
      }
      return parts;
    }
  }
}

/** One native body for `shape`: the single part itself, or `Body.create({ parts })` of a `COMPOUND`'s leaves. */
export function createShapeBody(shape: Shape2DDescriptor, options: IChamferableBodyDefinition): Body {
  if (shape.shape !== 'COMPOUND') {
    return createShapeParts(shape, options)[0];
  }
  return Body.create({ parts: createShapeParts(shape, options), ...options });
}

/**
 * Builds the sensor body of a trigger, for `MatterFactory.createTrigger` and
 * `MatterTriggerComponent.clone()`.
 */
export function buildMatterTriggerBody(
  shape: Shape2DDescriptor,
  transform?: {
    position?: Point2;
    rotation?: number;
  },
): Body {
  const nativeBody = createShapeBody(shape, { isSensor: true });
  // `Body.setPosition`/`Body.setAngle` rather than raw field writes, for the same reason as in
  // `buildMatterRigidBody` above
  Body.setPosition(nativeBody, toMatterPoint(transform?.position ?? Pnt2.O));
  Body.setAngle(nativeBody, transform?.rotation || 0);
  return nativeBody;
}

/**
 * matter-js's own body model only has `isStatic` - no distinct kinematic body type (position-
 * driven, but still pushes/wakes dynamic bodies it moves into) and no continuous collision
 * detection at all, at any level. Both are long-standing, documented upstream limitations, not
 * something this adapter package failed to wire up - see `BodyOptions.kinematic_pos`/
 * `ccd`'s own doc in `packages/core` for what each is supposed to do.
 *
 * `kinematic_pos`/`kinematic_vel` fall back to `isStatic: true` - the closest matter-js has - so
 * a caller gets *a* body rather than a thrown error, but with the exact same caveat as
 * teleporting a `static` body's position by hand (see that doc): resting bodies on top won't be
 * pushed or woken correctly. `ccd: true` is silently accepted as a no-op beyond the warning below -
 * a fast-moving or fast-driven body can still tunnel clean through thin geometry in one step.
 */
function transformOptions(options: Partial<Body2DOptions>): IChamferableBodyDefinition {
  if (options.bodyType === 'kinematic_pos' || options.bodyType === 'kinematic_vel') {
    warnUnsupportedOnce(
      `bodyType: '${options.bodyType}' has no matter-js equivalent - falling back to a plain static ` +
        "body. Resting bodies won't be pushed or woken when you move it, the same as manually " +
        "teleporting a static body's position. See Body2DOptions.kinematic_pos/kinematic_vel's doc.",
    );
  }
  if (options.ccd) {
    warnUnsupportedOnce(
      'ccd: true has no matter-js equivalent (no continuous collision detection at all) - ignored. ' +
        'A fast-moving or fast-driven body can still tunnel through thin geometry. See ' +
        "Body2DOptions.ccd's doc.",
    );
  }
  // `mass` is applied after creation by `applyMass`, never here - see its doc
  const res: IChamferableBodyDefinition = {
    isStatic: options.bodyType !== undefined ? options.bodyType != 'dynamic' : !options.mass,
    restitution: options.restitution,
    friction: options.friction,
  };
  for (const key in res) {
    if ((res as any)[key] === undefined) {
      delete (res as any)[key];
    }
  }
  return res;
}
