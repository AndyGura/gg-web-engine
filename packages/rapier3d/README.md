<p align="center">
  <img src="../../documentation/assets/logo.png" style="height: 400px; width:400px;" alt=''/>
</p>

## [Rapier.js](https://github.com/dimforge/rapier.js) 3D integration for [gg-web-engine](https://github.com/AndyGura/gg-web-engine), providing 3D phycics simulation

### Installation:
1) make sure **@gg-web-engine/core** installed
1) `npm install --save @gg-web-engine/rapier3d`


### Note
As per version `0.11.2`, `@dimforge/rapier3d` does not include `DynamicRayCastVehicleController` in the build, which is 
crucial for GG web engine. As a temporary workaround, `rapier3d` is built from latest revision on github and output 
files pushed directly here. As a result, in order to import something from rapier in your project, you have to add 
`./node_modules/@gg-web-engine/rapier3d/node_modules/` in your module resolution configuration. Installing separate 
rapier3d in your project may result in unexpected way
