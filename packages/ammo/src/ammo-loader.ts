import { IPhysicsBody3dComponentLoader } from '@gg-web-engine/core';
import { AmmoWorldComponent } from './components/ammo-world.component';

export class AmmoLoader extends IPhysicsBody3dComponentLoader {
  constructor(protected readonly world: AmmoWorldComponent) {
    super(world);
  }
}
