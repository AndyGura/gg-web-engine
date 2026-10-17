```ts
world.addParticleSystem(
  { capacity: 200 },
  {
    lifetime: 1,
    sizeOverLife: [0.5, 2], // grows from half to double size
    opacityOverLife: [{ t: 0, value: 0 }, { t: 0.1, value: 1 }, { t: 1, value: 0 }], // quick fade-in, slow fade-out
  },
);
```
