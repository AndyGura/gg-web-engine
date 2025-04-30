import { MatterFactory } from './matter-factory';
import { MatterRigidBodyComponent } from './components/matter-rigid-body.component';
import { Gg2dWorld, Gg2dWorldSceneTypeDocPPatch, Gg2dWorldTypeDocPPatch } from '@gg-web-engine/core';
import { MatterWorldComponent } from './components/matter-world.component';

export type MatterPhysicsTypeDocRepo = {
  factory: MatterFactory;
  rigidBody: MatterRigidBodyComponent;
  trigger: never;
};

export type MatterGgWorld = Gg2dWorld<
  Gg2dWorldTypeDocPPatch<MatterPhysicsTypeDocRepo>,
  Gg2dWorldSceneTypeDocPPatch<MatterPhysicsTypeDocRepo, MatterWorldComponent>
>;
