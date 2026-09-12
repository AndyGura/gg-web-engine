import {
  Body2DOptions,
  BodyShape2DDescriptor,
  IPhysicsBody2dComponentFactory,
  Pnt2,
  Point2,
  Shape2DDescriptor,
} from '@gg-web-engine/core';
import { ActiveEvents, ColliderDesc, RigidBodyDesc } from '@dimforge/rapier2d-compat';
import { Rapier2dRigidBodyComponent } from './components/rapier-2d-rigid-body.component';
import { Rapier2dTriggerComponent } from './components/rapier-2d-trigger.component';
import { Rapier2dWorldComponent } from './components/rapier-2d-world.component';
import { Rapier2dPhysicsTypeDocRepo } from './types';

export class Rapier2dFactory implements IPhysicsBody2dComponentFactory<Rapier2dPhysicsTypeDocRepo> {
  constructor(protected readonly world: Rapier2dWorldComponent) {}

  createRigidBody(
    descriptor: BodyShape2DDescriptor,
    transform?: {
      position?: Point2;
      rotation?: number;
    },
  ): Rapier2dRigidBodyComponent {
    return new Rapier2dRigidBodyComponent(
      this.world,
      this.createColliderDescr(descriptor.shape),
      descriptor.shape,
      this.createRigidBodyDescr(descriptor.body, transform),
      {
        friction: 0.5,
        restitution: 0.1,
        ownCollisionGroups: [this.world.mainCollisionGroup],
        interactWithCollisionGroups: [this.world.mainCollisionGroup],
        ...descriptor.body,
      },
    );
  }

  createTrigger(
    descriptor: Shape2DDescriptor,
    transform?: {
      position?: Point2;
      rotation?: number;
    },
  ): Rapier2dTriggerComponent {
    const colliderDescr = this.createColliderDescr(descriptor);
    colliderDescr.forEach(c => {
      c.isSensor = true;
    });
    return new Rapier2dTriggerComponent(
      this.world,
      colliderDescr,
      descriptor,
      this.createRigidBodyDescr({ dynamic: false }, transform),
    );
  }

  public createColliderDescr(descriptor: Shape2DDescriptor): ColliderDesc[] {
    let descrs: ColliderDesc[];
    switch (descriptor.shape) {
      case 'SQUARE':
        descrs = [ColliderDesc.cuboid(descriptor.dimensions.x / 2, descriptor.dimensions.y / 2)];
        break;
      case 'CIRCLE':
        descrs = [ColliderDesc.ball(descriptor.radius)];
        break;
      default:
        throw new Error(`Shape "${(descriptor as any).shape}" not implemented for Rapier 2D`);
    }
    // Every collider (trigger sensors and ordinary rigid-body colliders alike) needs
    // COLLISION_EVENTS active so `Rapier2dWorldComponent.simulate()` can drain both sensor
    // overlap transitions (trigger enter/exit) and real contact start/stop transitions (rigid
    // body onCollisionStart/onCollisionEnd) from the same event queue - Rapier only needs one
    // side of a pair to have the flag set, but setting it universally here keeps every pair
    // covered regardless of which side is which.
    descrs.forEach(d => d.setActiveEvents(ActiveEvents.COLLISION_EVENTS));
    return descrs;
  }

  public createRigidBodyDescr(
    options: Partial<Body2DOptions>,
    transform?: { position?: Point2; rotation?: number },
  ): RigidBodyDesc {
    const pos = transform?.position || Pnt2.O;
    const rot = transform?.rotation || 0;
    const fixed = options.dynamic === false || !options.mass;
    let bodyDesc!: RigidBodyDesc;
    if (fixed) {
      bodyDesc = RigidBodyDesc.fixed();
    } else {
      bodyDesc = RigidBodyDesc.dynamic();
      bodyDesc.mass = options.mass || 1;
    }
    return bodyDesc.setTranslation(pos.x, pos.y).setRotation(rot);
  }
}
