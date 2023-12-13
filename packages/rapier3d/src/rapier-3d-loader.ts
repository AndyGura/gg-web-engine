import { IPhysicsBody3dComponentLoader } from '@gg-web-engine/core';
import { Rapier3dWorldComponent } from './components/rapier-3d-world.component';
import { Rapier3dPhysicsTypeDocRepo } from './types';

export class Rapier3dLoader extends IPhysicsBody3dComponentLoader<Rapier3dPhysicsTypeDocRepo> {
  constructor(protected readonly world: Rapier3dWorldComponent) {
    super(world);
  }
}
