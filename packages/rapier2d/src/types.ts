import { Rapier2dFactory } from './rapier-2d-factory';
import { Rapier2dRigidBodyComponent } from './components/rapier-2d-rigid-body.component';
import { Rapier2dTriggerComponent } from './components/rapier-2d-trigger.component';
import { Gg2dWorld, Gg2dWorldSceneTypeDocPPatch, Gg2dWorldTypeDocPPatch } from '@gg-web-engine/core';
import { Rapier2dWorldComponent } from './components/rapier-2d-world.component';

export type Rapier2dPhysicsTypeDocRepo = {
  factory: Rapier2dFactory;
  rigidBody: Rapier2dRigidBodyComponent;
  trigger: Rapier2dTriggerComponent;
};

export type Rapier2dGgWorld = Gg2dWorld<
  Gg2dWorldTypeDocPPatch<Rapier2dPhysicsTypeDocRepo>,
  Gg2dWorldSceneTypeDocPPatch<Rapier2dPhysicsTypeDocRepo, Rapier2dWorldComponent>
>;
