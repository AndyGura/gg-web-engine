<p align="center">
  <img src="../../documentation/assets/logo.png" style="height: 400px; width:400px;" alt=''/>
</p>

## [Three.js](https://github.com/mrdoob/three.js) integration for [gg-web-engine](https://github.com/AndyGura/gg-web-engine), providing 3D rendering

### Installation:
1) make sure **@gg-web-engine/core** installed
1) `npm install --save @gg-web-engine/three`

Addons are not included in three.js build, so they are not included here as well to omit error "Cannot use import 
statement outside a module" on some systems. So if you need to use GLB loader in your project, you have to import loader
instance and register it:
```
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

world.visualScene.loader.registerGltfLoaderAddon(new GLTFLoader());
```
