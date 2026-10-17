```ts
import { Gg3dWorld, IEntity, LevelJson, Point3, TickOrder } from '@gg-web-engine/core';

class Spinner extends IEntity {
  static readonly entityTypeName: string = 'Spinner';
  public readonly tickOrder = TickOrder.CONTROLLERS;
}

// the generator gets the world and the entity's JSON `config`, plus its `name`/`position`/
// `rotation`/`shape` when the JSON sets them
world.loader.registerClass('Spinner', (w: Gg3dWorld, settings: { position?: Point3; speed?: number }) => {
  const spinner = new Spinner();
  // ...build it from settings.position / settings.speed
  return spinner; // must return an IEntity; loadLevel adds it to the world
});

const level: LevelJson = {
  entities: [{ class: 'Spinner', name: 'Fan', position: { x: 0, y: 0, z: 3 }, config: { speed: 2 } }],
};
await world.loader.loadLevel(level, 'Room');
```
