import {
  BodyShape2DDescriptor,
  CharacterController2dOptions,
  IPhysicsBody2dComponentFactory,
  Pnt2,
  Point2,
  Shape2DDescriptor,
} from '@gg-web-engine/core';
import { MatterRigidBodyComponent } from './components/matter-rigid-body.component';
import { MatterTriggerComponent } from './components/matter-trigger.component';
import { MatterCharacterControllerComponent } from './components/matter-character-controller.component';
import { MatterWorldComponent } from './components/matter-world.component';
import { Bodies, Body, Vector } from 'matter-js';
import { buildMatterRigidBody, createShapeBody } from './matter-rigid-body-builder';
import { MatterPhysicsTypeDocRepo } from './types';

export class MatterFactory implements IPhysicsBody2dComponentFactory<MatterPhysicsTypeDocRepo> {
  constructor(protected readonly world: MatterWorldComponent) {}

  createRigidBody(
    descriptor: BodyShape2DDescriptor,
    transform?: {
      position?: Point2;
      rotation?: number;
    },
  ): MatterRigidBodyComponent {
    return buildMatterRigidBody(descriptor, transform);
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
      case 'BOX':
        nativeBody = Bodies.rectangle(0, 0, descriptor.dimensions.x, descriptor.dimensions.y, { isSensor: true });
        break;
      case 'CIRCLE':
        nativeBody = Bodies.circle(0, 0, descriptor.radius, { isSensor: true });
        break;
      case 'CAPSULE':
        nativeBody = Bodies.rectangle(0, 0, descriptor.radius * 2, descriptor.centersDistance + descriptor.radius * 2, {
          isSensor: true,
          chamfer: {
            radius: descriptor.radius,
          },
        });
        break;
      case 'CONVEX_HULL':
        nativeBody = Bodies.fromVertices(0, 0, [Pnt2.hull(descriptor.vertices).map(v => Vector.create(v.x, v.y))], {
          isSensor: true,
        });
        break;
      case 'POLYGON':
        nativeBody = Bodies.fromVertices(0, 0, [descriptor.vertices.map(v => Vector.create(v.x, v.y))], {
          isSensor: true,
        });
        break;
      case 'COMPOUND':
        nativeBody = createShapeBody(descriptor, { isSensor: true });
        break;
    }
    if (!nativeBody) {
      throw new Error(`Shape "${descriptor.shape}" not implemented for Matter.js`);
    }
    // See the identical fix (and its doc) in `createRigidBody` above - a trigger's collision
    // geometry needs the same real `Body.setPosition`/`Body.setAngle` treatment, not a raw
    // `.position.x`/`.position.y`/`.angle` field write.
    Body.setPosition(nativeBody, Vector.create(transform?.position?.x || 0, transform?.position?.y || 0));
    Body.setAngle(nativeBody, transform?.rotation || 0);

    if (!this.world) {
      throw new Error('MatterFactory: World not set. Make sure the factory is created by MatterWorldComponent.');
    }

    return new MatterTriggerComponent(nativeBody, descriptor, this.world);
  }

  createCharacterController(
    options: CharacterController2dOptions,
    transform?: {
      position?: Point2;
      rotation?: number;
    },
  ): MatterCharacterControllerComponent {
    return new MatterCharacterControllerComponent(this.world, options, transform);
  }
}
