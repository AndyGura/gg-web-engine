```ts
// a 1 kg crate, 30 px wide, spawned 200 px above the origin (screen Y points down)
const crate = world.addPrimitiveRigidBody(
  { shape: { shape: 'BOX', dimensions: { x: 30, y: 30 } }, body: { mass: 1 } },
  { x: 0, y: -200 },
  0,
  { color: 0x996633, stroke: { color: 0x000000, width: 2 } },
);
// later: remove it and free its display object and body
world.removeEntity(crate, true);
```
