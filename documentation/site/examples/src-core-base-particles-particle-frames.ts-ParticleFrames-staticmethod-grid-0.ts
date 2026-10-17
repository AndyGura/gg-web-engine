```ts
// a 4x1 strip of dust-puff frames, played over each particle's life
const dust = world.addParticleSystem(
  { capacity: 64, texture: dustStrip },
  { lifetime: 0.5, size: 24, frames: ParticleFrames.grid(4, 1), frameSequence: [0, 1, 2, 3] },
);
```
