import { IPhysicsBody3dComponentLoader } from '@gg-web-engine/core';
import { AmmoWorldComponent } from './components/ammo-world.component';
import { AmmoPhysicsTypeDocRepo } from './types';

export class AmmoLoader extends IPhysicsBody3dComponentLoader<AmmoPhysicsTypeDocRepo> {
  constructor(protected readonly world: AmmoWorldComponent) {
    super(world);
  }
}
