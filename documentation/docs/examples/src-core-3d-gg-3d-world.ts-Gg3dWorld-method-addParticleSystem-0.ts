```ts
// embers rising from a campfire at the origin (3D worlds are Z-up), plus a one-off burst
const embers = world.addParticleSystem(
  { capacity: 300, blending: 'additive' },
  {
    rate: 40, // particles per second, while emitting
    lifetime: [0.6, 1.2],
    size: 0.15,
    tint: 0xff8833,
    gravity: { x: 0, y: 0, z: 1.5 },
    opacityOverLife: [1, 0],
  },
);
embers.position = { x: 0, y: 0, z: 0.2 };
embers.emit(40, (p, ctx) => {
  p.velocity = { x: ctx.range(-2, 2), y: ctx.range(-2, 2), z: ctx.range(1, 4) };
});
```
