<p align="center">
  <img src="../../documentation/assets/banner.png" width="100%" alt="GG Web Engine"/>
</p>

## [Three.js](https://github.com/mrdoob/three.js) integration for [gg-web-engine](https://github.com/AndyGura/gg-web-engine), providing 3D rendering

### Installation:
1) make sure **@gg-web-engine/core** installed
1) `npm install --save @gg-web-engine/three`

The package brings `three` (with `@types/three`) as its own dependency, pinned to the exact version it is
built and tested against, so nothing else needs installing. If your app also imports it directly,
use that same version, so the bundle carries only one copy.

Addons are not included in three.js build, but `@gg-web-engine/three` provides GLTFLoader:
```
import { GLTFLoader } from '@gg-web-engine/three';
```
