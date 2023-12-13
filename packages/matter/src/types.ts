import { MatterFactory } from './matter-factory';
import { MatterRigidBodyComponent } from './components/matter-rigid-body.component';

export type MatterPhysicsTypeDocRepo = {
  factory: MatterFactory;
  rigidBody: MatterRigidBodyComponent;
  trigger: never;
};
