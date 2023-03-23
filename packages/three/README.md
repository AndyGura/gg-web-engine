<p align="center">
  <img src="../../documentation/assets/logo.png" style="height: 400px; width:400px;" alt=''/>
</p>

## [Three.js](https://github.com/mrdoob/three.js) integration for [gg-web-engine](https://github.com/AndyGura/gg-web-engine), providing 3D rendering

### Installation:
1) make sure **@gg-web-engine/core** installed
1) `npm install --save @gg-web-engine/three`
1) Add to your `tsconfig.json` in the record `compilerOptions.paths`:
```json lines
"three": ["./node_modules/@gg-web-engine/three/node_modules/three"]
```
