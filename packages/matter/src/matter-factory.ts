import {
  Body2DOptions,
  BodyShape2DDescriptor,
  BodyType,
  IPhysicsBody2dComponentFactory,
  Point2,
  Shape2DDescriptor,
  warnOnce,
} from '@gg-web-engine/core';
import { MatterRigidBodyComponent } from './components/matter-rigid-body.component';
import { MatterTriggerComponent } from './components/matter-trigger.component';
import { MatterWorldComponent } from './components/matter-world.component';
import { Bodies, Body, IChamferableBodyDefinition, Vector } from 'matter-js';
import { MatterPhysicsTypeDocRepo } from './types';

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

export class MatterFactory implements IPhysicsBody2dComponentFactory<MatterPhysicsTypeDocRepo> {
  constructor(protected readonly world: MatterWorldComponent) {}

  createRigidBody(
    descriptor: BodyShape2DDescriptor,
    transform?: {
      position?: Point2;
      rotation?: number;
    },
  ): MatterRigidBodyComponent {
    let nativeBody: Body | null = null;
    switch (descriptor.shape.shape) {
      case 'SQUARE':
        nativeBody = Bodies.rectangle(
          0,
          0,
          descriptor.shape.dimensions.x,
          descriptor.shape.dimensions.y,
          this.transformOptions(descriptor.body),
        );
        break;
      case 'CIRCLE':
        nativeBody = Bodies.circle(0, 0, descriptor.shape.radius, this.transformOptions(descriptor.body));
        break;
    }
    if (!nativeBody) {
      throw new Error(`Shape "${descriptor.shape}" not implemented for Matter.js`);
    }
    nativeBody.position = Vector.create(transform?.position?.x || 0, transform?.position?.y || 0);
    nativeBody.angle = transform?.rotation || 0;
    const bodyType: BodyType = descriptor.body.bodyType ?? (descriptor.body.mass ? 'dynamic' : 'static');
    return new MatterRigidBodyComponent(nativeBody, descriptor.shape, bodyType, !!descriptor.body.ccd);
  }

  createTrigger(
    descriptor: Shape2DDescriptor,
    transform?: {
      position?: Point2;
      rotation?: number;
    },
  ): MatterTriggerComponent {
    let nativeBody: Body | null = null;
    switch (descriptor.shape) {
      case 'SQUARE':
        nativeBody = Bodies.rectangle(0, 0, descriptor.dimensions.x, descriptor.dimensions.y, { isSensor: true });
        break;
      case 'CIRCLE':
        nativeBody = Bodies.circle(0, 0, descriptor.radius, { isSensor: true });
        break;
    }
    if (!nativeBody) {
      throw new Error(`Shape "${descriptor.shape}" not implemented for Matter.js`);
    }
    nativeBody.position.x = transform?.position?.x || 0;
    nativeBody.position.y = transform?.position?.y || 0;
    nativeBody.angle = transform?.rotation || 0;

    if (!this.world) {
      throw new Error('MatterFactory: World not set. Make sure the factory is created by MatterWorldComponent.');
    }

    return new MatterTriggerComponent(nativeBody, descriptor, this.world);
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
  private transformOptions(options: Partial<Body2DOptions>): IChamferableBodyDefinition {
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
}
