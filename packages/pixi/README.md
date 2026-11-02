<p align="center">
  <img src="../../documentation/assets/banner.png" width="100%" alt="GG Web Engine"/>
</p>

## [Pixi.js](https://github.com/pixijs/pixijs) integration for [gg-web-engine](https://github.com/AndyGura/gg-web-engine), providing 2D rendering

### Installation:
1) make sure **@gg-web-engine/core** installed
1) `npm install --save @gg-web-engine/pixi`
1) add to your `tsconfig.json` in the record `compilerOptions`:
    ```json lines
    "allowSyntheticDefaultImports": true,
    ```
1) add to your `tsconfig.json` in the array `compilerOptions.types`:
    ```
    "offscreencanvas"
    ```

The package brings `pixi.js` as its own dependency, pinned to the exact version it is
built and tested against, so nothing else needs installing. If your app also imports it directly,
use that same version, so the bundle carries only one copy.

### Units: meters and pixels per meter

A 2D world is measured in meters, like a 3D one. The scene's `pixelsPerMeter` (default `100`) is
its texel density: at camera `zoom` 1 a meter covers that many screen pixels and a texture is drawn
at one texel per screen pixel, so a 48x72 px sprite is 0.48x0.72 m; `zoom` 2 doubles both. Shape
dimensions (`createBox({ x: 1, y: 2 })`), positions, particle sizes and a parallax layer's `offset`
are meters; a text's `fontSize`, a `stroke` width and a parallax `scale` are in pixels/texels. A
display object's `scale` is relative to the size it was built at.

```ts
import { Gg2dWorld } from '@gg-web-engine/core';
import { PixiSceneComponent } from '@gg-web-engine/pixi';

const world = new Gg2dWorld({ visualScene: new PixiSceneComponent({ pixelsPerMeter: 50 }) });
await world.init();
const camera = world.visualScene.factory.createCamera();
camera.worldToScreen({ x: 1, y: 0 }); // { x: 50, y: 0 } from the camera position at zoom 1
```

A HUD or menu world laid out in canvas pixels uses one pixel per meter and a top-left camera:

```ts
const hud = new Gg2dWorld({ visualScene: new PixiSceneComponent({ pixelsPerMeter: 1 }) });
await hud.init();
const camera = hud.visualScene.factory.createCamera();
camera.origin = 'top-left';
hud.addRenderer(camera, canvas, { transparent: true });
hud.visualScene.factory.createText('Score', { fontSize: 24 }).position = { x: 16, y: 16 }; // pixels
```
