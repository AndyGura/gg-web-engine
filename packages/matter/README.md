<p align="center">
  <img src="../../documentation/assets/logo.png" style="height: 400px; width:400px;" alt=''/>
</p>

## [Matter.js](https://github.com/liabru/matter-js) integration for [gg-web-engine](https://github.com/AndyGura/gg-web-engine), providing 2D physics simulation

### Installation:
1) make sure **@gg-web-engine/core** installed
1) `npm install --save @gg-web-engine/matter`
1) Add to your `tsconfig.json` in the record `compilerOptions.paths`:
```json lines
"matter-js": ["./node_modules/@gg-web-engine/matter/node_modules/matter-js"]
```
