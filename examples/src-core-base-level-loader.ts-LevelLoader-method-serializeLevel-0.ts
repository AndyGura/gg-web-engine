```ts
const level = await world.loader.loadLevel(levelJson, 'Level');
// ...play: bodies move, cars change gear...
const saved = world.loader.serializeLevel(level); // a LevelJson of the current state
localStorage.setItem('save', JSON.stringify(saved));

// restore: drop the live level, load the saved one under the same name
world.removeEntity(level, true);
await world.loader.loadLevel(JSON.parse(localStorage.getItem('save')!), 'Level');
```
