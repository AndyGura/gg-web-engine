```ts
import { OrbitCameraController } from '@gg-web-engine/core';

// built-in controllers and any app-defined IEntity subclass go through addEntity
const orbit = new OrbitCameraController(renderer);
world.addEntity(orbit);
// names are unique world-wide: find it again from anywhere
orbit.name = 'CameraControl';
world.getEntityByName<OrbitCameraController>('CameraControl').active = false;
```
