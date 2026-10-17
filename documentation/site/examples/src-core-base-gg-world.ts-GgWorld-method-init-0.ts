```ts
import { Gg3dWorld } from '@gg-web-engine/core';
import { ThreeSceneComponent } from '@gg-web-engine/three';
import { AmmoWorldComponent } from '@gg-web-engine/ammo';

const world = new Gg3dWorld({ visualScene: new ThreeSceneComponent(), physicsWorld: new AmmoWorldComponent() });
await world.init();
// now safe: world.visualScene.factory, world.physicsWorld.factory, world.loader.loadLevel(...)
```
