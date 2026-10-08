<p align="center">
  <img src="../../documentation/assets/banner.png" width="100%" alt="GG Web Engine"/>
</p>

## [Matter.js](https://github.com/liabru/matter-js) integration for [gg-web-engine](https://github.com/AndyGura/gg-web-engine), providing 2D physics simulation

### Installation:
1) make sure **@gg-web-engine/core** installed
1) `npm install --save @gg-web-engine/matter`

The package brings `matter-js` (with `@types/matter-js`) as its own dependency, pinned to the exact version it is
built and tested against, so nothing else needs installing. If your app also imports it directly,
use that same version, so the bundle carries only one copy.
