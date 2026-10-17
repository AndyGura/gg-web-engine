```ts
import { LevelJson } from '@gg-web-engine/core';

const levelJson: LevelJson = {
  entities: [
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'Floor',
      config: { dimensions: { x: 20, y: 20, z: 1 }, body: { bodyType: 'static' } },
    },
    // 3D is Z-up: this crate starts 5 m above the floor
    { class: 'Primitive', shape: 'BOX', name: 'Crate', position: { x: 0, y: 0, z: 5 }, config: { dimensions: { x: 1, y: 1, z: 1 } } },
  ],
};

const level = await world.loader.loadLevel(levelJson, 'Level', { onProgress: p => console.log(p.fraction) });
const crate = level.getChildEntityByName('Crate');
// tear the whole level down (and free what only it loaded) in one call
world.removeEntity(level, true);
```
