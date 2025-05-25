import { MatterFactory } from './matter-factory';
import { MatterRigidBodyComponent } from './components/matter-rigid-body.component';
import { MatterTriggerComponent } from './components/matter-trigger.component';
import { Gg2dWorld, Gg2dWorldSceneTypeDocPPatch, Gg2dWorldTypeDocPPatch } from '@gg-web-engine/core';
import { MatterWorldComponent } from './components/matter-world.component';

export type MatterPhysicsTypeDocRepo = {
  factory: MatterFactory;
  rigidBody: MatterRigidBodyComponent;
  trigger: MatterTriggerComponent;
};

export type MatterTypeDoc = Gg2dWorldTypeDocPPatch<MatterPhysicsTypeDocRepo>;
export type MatterSceneTypeDoc = Gg2dWorldSceneTypeDocPPatch<MatterPhysicsTypeDocRepo, MatterWorldComponent>;

export type MatterGgWorld = Gg2dWorld<MatterTypeDoc, MatterSceneTypeDoc>;
