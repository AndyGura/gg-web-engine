```ts
const renderer = world.addRenderer(
  world.visualScene.factory.createCamera(),
  document.getElementById('gg') as HTMLCanvasElement,
  { background: 0x87ceeb },
);
// fit an 800x600 px playfield into whatever size the canvas gets
renderer.rendererSize$.subscribe(size => {
  if (size) renderer.camera.zoom = Math.min(size.x / 800, size.y / 600);
});
```
