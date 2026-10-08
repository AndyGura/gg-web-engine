<p align="center">
  <img src="../../documentation/assets/banner.png" width="100%" alt="GG Web Engine"/>
</p>

## [Ammo.js](https://github.com/kripken/ammo.js) integration for [gg-web-engine](https://github.com/AndyGura/gg-web-engine), providing 3D physics simulation

### Note:
This module uses self-built ammo.js, because requires additional functionality. Do not install another copy of ammo.js, 
if you need direct access, import it straight from this module: 
```typescript
import { Ammo } from "@gg-web-engine/ammo";
``` 

### Installation:
1) make sure **@gg-web-engine/core** installed
1) `npm install --save @gg-web-engine/ammo`

The bundled ammo.js glue references Node's `fs`, only on its Node.js code path. This package's own
`browser` field maps it away, which webpack, esbuild (Angular) and Vite honor, so an app needs no
bundler configuration for it.
