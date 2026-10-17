```ts
const crate = world.addPrimitiveRigidBody({
  shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } },
  body: { mass: 1 },
});
world.removeEntity(crate); // hidden for now, can come back with world.addEntity(crate)
world.addEntity(crate);
world.removeEntity(crate, true); // gone for good
```
