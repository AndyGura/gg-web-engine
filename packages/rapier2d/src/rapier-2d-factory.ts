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
        ccd: false,
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
      this.createRigidBodyDescr({ bodyType: 'static' }, transform),
    );
  }

  public createColliderDescr(descriptor: Shape2DDescriptor): ColliderDesc[] {
    let descrs: ColliderDesc[];
    switch (descriptor.shape) {
      case 'BOX':
        descrs = [ColliderDesc.cuboid(descriptor.dimensions.x / 2, descriptor.dimensions.y / 2)];
        break;
      case 'CIRCLE':
        descrs = [ColliderDesc.ball(descriptor.radius)];
        break;
      case 'CAPSULE':
        descrs = [ColliderDesc.capsule(descriptor.centersDistance / 2, descriptor.radius)];
        break;
      case 'CONVEX_HULL': {
        const points = new Float32Array(descriptor.vertices.length * 2);
        descriptor.vertices.forEach((v, i) => {
          points[i * 2] = v.x;
          points[i * 2 + 1] = v.y;
        });
        const colliderDesc = ColliderDesc.convexHull(points);
        if (!colliderDesc) {
          throw new Error('Rapier 2D: failed to build a convex hull for the given CONVEX_HULL vertices');
        }
        descrs = [colliderDesc];
        break;
      }
      case 'POLYGON': {
        const points = new Float32Array(descriptor.vertices.length * 2);
        descriptor.vertices.forEach((v, i) => {
          points[i * 2] = v.x;
          points[i * 2 + 1] = v.y;
        });
        const segments = new Uint32Array(descriptor.vertices.length * 2);
        descriptor.vertices.forEach((_, i) => {
          segments[i * 2] = i;
          segments[i * 2 + 1] = (i + 1) % descriptor.vertices.length;
        });
        const colliderDesc = ColliderDesc.convexDecomposition(points, segments);
        if (!colliderDesc) {
          throw new Error('Rapier 2D: failed to build a convex decomposition for the given POLYGON vertices');
        }
        descrs = [colliderDesc];
        break;
      }
      case 'COMPOUND': {
        const res: ColliderDesc[] = [];
        for (const item of descriptor.children) {
          const subDescrs = this.createColliderDescr(item.shape);
          subDescrs.forEach(d => {
            const p = Pnt2.add(item.position || Pnt2.O, d.translation);
            d.setTranslation(p.x, p.y);
            d.setRotation((item.rotation || 0) + d.rotation);
          });
          res.push(...subDescrs);
        }
        descrs = res;
        break;
      }
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
    let bodyDesc!: RigidBodyDesc;
    let bodyType = options.bodyType || (options.mass ? 'dynamic' : 'static');
    if (bodyType === 'static') {
      bodyDesc = RigidBodyDesc.fixed();
    } else if (bodyType === 'kinematic_pos') {
      bodyDesc = RigidBodyDesc.kinematicPositionBased();
    } else if (bodyType === 'kinematic_vel') {
      bodyDesc = RigidBodyDesc.kinematicVelocityBased();
    } else {
      bodyDesc = RigidBodyDesc.dynamic();
      bodyDesc.mass = options.mass || 1;
      // Only a dynamic body can tunnel through geometry it crosses within a single step - see
      // `BodyOptions.ccd`'s own doc.
      bodyDesc.setCcdEnabled(!!options.ccd);
    }
    return bodyDesc.setTranslation(pos.x, pos.y).setRotation(rot);
  }
}
