import { IPhysicsBody3dComponentLoader } from '@gg-web-engine/core';
import { Rapier3dWorldComponent } from './components/rapier-3d-world.component';

export class Rapier3dLoader extends IPhysicsBody3dComponentLoader {
  constructor(protected readonly world: Rapier3dWorldComponent) {
    super(world);
  }
}
