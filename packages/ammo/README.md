<p align="center">
  <img src="../../documentation/assets/logo.png" style="height: 400px; width:400px;" alt=''/>
</p>

## [Ammo.js](https://github.com/kripken/ammo.js) integration for [gg-web-engine](https://github.com/AndyGura/gg-web-engine), providing 3D phycics simulation

### Installation:
1) make sure **@gg-web-engine/core** installed
1) `npm install --save @gg-web-engine/ammo`
1) Add to your `tsconfig.json` in the record `compilerOptions.paths`:
```json lines
"mini-signals": ["./node_modules/mini-signals/index.js"]
```
1) Add to your `package.json`:
```json lines
"browser": {
    "fs": false,
    "os": false,
    "path": false
}
```
