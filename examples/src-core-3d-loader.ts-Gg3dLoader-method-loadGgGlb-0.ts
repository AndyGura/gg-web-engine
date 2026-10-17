```ts
import { Pnt3, Qtrn } from '@gg-web-engine/core';

// fetches assets/house.glb + assets/house.meta (exported from Blender with the GG exporter add-on)
const { entities, props } = await world.loader.loadGgGlb('assets/house', {
  position: { x: 10, y: 0, z: 0 },
  rotation: Qtrn.fromAngle(Pnt3.Z, Math.PI / 2), // turned 90° around the up axis
  nameScope: 'House1', // entities are named "House1__<Blender object name>"
});
for (const entity of [...entities, ...(props ?? []).flatMap(p => p.entities)]) {
  world.addEntity(entity);
}
```
