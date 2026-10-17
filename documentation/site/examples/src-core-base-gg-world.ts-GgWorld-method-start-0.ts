```ts
await world.init();
await world.loader.loadLevel(levelJson, 'Level');
world.start();

world.keyboardInput.bind('KeyP').subscribe(down => {
  if (down) world.isPaused ? world.resumeWorld() : world.pauseWorld();
});
```
