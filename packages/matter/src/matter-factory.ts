import {
  BodyShape2DDescriptor,
  CharacterController2dOptions,
  IPhysicsBody2dComponentFactory,
  Point2,
  Shape2DDescriptor,
} from '@gg-web-engine/core';
import { MatterRigidBodyComponent } from './components/matter-rigid-body.component';
import { MatterTriggerComponent } from './components/matter-trigger.component';
import { MatterCharacterControllerComponent } from './components/matter-character-controller.component';
import { MatterWorldComponent } from './components/matter-world.component';
import { buildMatterRigidBody, buildMatterTriggerBody } from './matter-rigid-body-builder';
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
    if (!this.world) {
      throw new Error('MatterFactory: World not set. Make sure the factory is created by MatterWorldComponent.');
    }

    return new MatterTriggerComponent(buildMatterTriggerBody(descriptor, transform), descriptor, this.world);
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
