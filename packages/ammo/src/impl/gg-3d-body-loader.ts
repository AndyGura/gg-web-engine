import { IGg3dBodyLoader } from '@gg-web-engine/core';
import { Gg3dPhysicsWorld } from './gg-3d-physics-world';

export class Gg3dBodyLoader extends IGg3dBodyLoader {
  constructor(protected readonly world: Gg3dPhysicsWorld) {
    super(world);
  }
}
