```ts
// sparks bursting out of a collected coin (2D worlds are in pixels, +Y points down)
const sparks = world.addParticleSystem(
  { capacity: 200, blending: 'additive', zIndex: 5 },
  { lifetime: [0.3, 0.7], size: 10, gravity: { x: 0, y: 900 }, drag: 2, opacityOverLife: [1, 0] },
);
sparks.position = coin.position;
sparks.emit(12, (p, ctx) => {
  const angle = ctx.range(0, Math.PI * 2);
  p.velocity = { x: Math.cos(angle) * 300, y: Math.sin(angle) * 300 };
});
```
