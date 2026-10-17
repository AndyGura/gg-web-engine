```ts
import { Pnt3, Qtrn } from '@gg-web-engine/core';

// a 1 kg ball dropped from 10 m above the origin
const ball = world.addPrimitiveRigidBody(
  { shape: { shape: 'SPHERE', radius: 0.5 }, body: { mass: 1 } },
  Pnt3.scalarMult(Pnt3.Z, 10),
  Qtrn.O,
  { color: 0xff8800 },
);
// later: remove it and free its mesh and body
world.removeEntity(ball, true);
```
