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
