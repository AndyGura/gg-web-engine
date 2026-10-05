import {
  Body2DOptions,
  BodyShape2DDescriptor,
  BodyType,
  Pnt2,
  Point2,
  Shape2DDescriptor,
  warnOnce,
} from '@gg-web-engine/core';
import { Bodies, Body, Common, IChamferableBodyDefinition, Vector } from 'matter-js';
import * as decomp from 'poly-decomp';
import { MatterRigidBodyComponent } from './components/matter-rigid-body.component';

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
  let nativeBody: Body | null = null;
  switch (descriptor.shape.shape) {
    case 'BOX':
      nativeBody = Bodies.rectangle(
        0,
        0,
        descriptor.shape.dimensions.x,
        descriptor.shape.dimensions.y,
        transformOptions(descriptor.body),
      );
      break;
    case 'CIRCLE':
      nativeBody = Bodies.circle(0, 0, descriptor.shape.radius, transformOptions(descriptor.body));
      break;
    case 'CAPSULE':
      nativeBody = Bodies.rectangle(
        0,
        0,
        descriptor.shape.radius * 2,
        descriptor.shape.centersDistance + descriptor.shape.radius * 2,
        {
          ...transformOptions(descriptor.body),
          chamfer: {
            radius: descriptor.shape.radius,
          },
        },
      );
      break;
    case 'CONVEX_HULL':
      nativeBody = Bodies.fromVertices(
        0,
        0,
        [Pnt2.hull(descriptor.shape.vertices).map(v => Vector.create(v.x, v.y))],
        transformOptions(descriptor.body),
      );
      break;
    case 'POLYGON':
      nativeBody = Bodies.fromVertices(
        0,
        0,
        [descriptor.shape.vertices.map(v => Vector.create(v.x, v.y))],
        transformOptions(descriptor.body),
      );
      break;
    case 'COMPOUND':
      nativeBody = createShapeBody(descriptor.shape, transformOptions(descriptor.body));
      break;
  }
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
  Body.setPosition(nativeBody, Vector.create(transform?.position?.x || 0, transform?.position?.y || 0));
  Body.setAngle(nativeBody, transform?.rotation || 0);
  const bodyType: BodyType = descriptor.body.bodyType ?? (descriptor.body.mass ? 'dynamic' : 'static');
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

function createShapeParts(shape: Shape2DDescriptor, options: IChamferableBodyDefinition): Body[] {
  switch (shape.shape) {
    case 'BOX':
      return [Bodies.rectangle(0, 0, shape.dimensions.x, shape.dimensions.y, options)];
    case 'CIRCLE':
      return [Bodies.circle(0, 0, shape.radius, options)];
    case 'CAPSULE':
      return [
        Bodies.rectangle(0, 0, shape.radius * 2, shape.centersDistance + shape.radius * 2, {
          ...options,
          chamfer: { radius: shape.radius },
        }),
      ];
    case 'CONVEX_HULL':
      return [Bodies.fromVertices(0, 0, [Pnt2.hull(shape.vertices).map(v => Vector.create(v.x, v.y))], options)];
    case 'POLYGON':
      return [Bodies.fromVertices(0, 0, [shape.vertices.map(v => Vector.create(v.x, v.y))], options)];
    case 'COMPOUND': {
      const parts: Body[] = [];
      for (const { position, rotation, shape: childShape } of shape.children) {
        const childParts = createShapeParts(childShape, options);
        for (const part of childParts) {
          Body.setPosition(
            part,
            Vector.add(Vector.rotate(part.position, rotation || 0), Vector.create(position?.x || 0, position?.y || 0)),
          );
          Body.setAngle(part, part.angle + (rotation || 0));
        }
        parts.push(...childParts);
      }
      return parts;
    }
  }
}

export function createShapeBody(shape: Shape2DDescriptor, options: IChamferableBodyDefinition): Body {
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
  const options: IChamferableBodyDefinition = { isSensor: true };
  const nativeBody = shape.shape === 'COMPOUND' ? createShapeBody(shape, options) : createShapeParts(shape, options)[0];
  // `Body.setPosition`/`Body.setAngle` rather than raw field writes, for the same reason as in
  // `buildMatterRigidBody` above
  Body.setPosition(nativeBody, Vector.create(transform?.position?.x || 0, transform?.position?.y || 0));
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
  const res: IChamferableBodyDefinition = {
    isStatic: options.bodyType !== undefined ? options.bodyType != 'dynamic' : !options.mass,
    mass: options.mass,
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
