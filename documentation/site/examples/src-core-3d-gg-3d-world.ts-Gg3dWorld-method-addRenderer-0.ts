```ts
import { Pnt3, Qtrn } from '@gg-web-engine/core';

const renderer = world.addRenderer(
  world.visualScene.factory.createPerspectiveCamera({ fov: 70 }),
  document.getElementById('gg') as HTMLCanvasElement,
);
// 3D worlds are Z-up: stand 10 m back on -Y, 3 m up, looking at the origin
renderer.position = { x: 0, y: -10, z: 3 };
renderer.rotation = Qtrn.lookAt(renderer.position, Pnt3.O);
```
