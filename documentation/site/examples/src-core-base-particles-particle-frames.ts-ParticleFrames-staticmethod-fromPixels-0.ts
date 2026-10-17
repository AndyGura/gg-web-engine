```ts
// two sprites of different sizes packed into a 128x64 px atlas; each particle picks one
const frames = ParticleFrames.fromPixels(
  [
    { x: 0, y: 0, width: 64, height: 64 },
    { x: 64, y: 0, width: 64, height: 32 },
  ],
  128,
  64,
);
const debris = world.addParticleSystem({ capacity: 100, texture: atlas }, { frames, lifetime: 2 });
debris.emit(10, (p, ctx) => {
  p.frame = ctx.random() < 0.5 ? 0 : 1;
});
```
