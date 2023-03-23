<p align="center">
  <img src="documentation/assets/logo.png" style="height: 400px; width:400px;" alt=''/>
</p>
<h2 align="center">An attempt to create open source abstract game engine for browser</h2>

<p align="center">
  <a href="#about">About</a> •
  <a href="#vision">Vision</a> •
  <a href="#status">Status</a> •
  <a href="#features">Features</a> •
  <a href="#integrations">Integrations</a> •
  <a href="#quickstart">Quickstart</a> •
  <a href="#examples">Examples</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#support">Support</a> •
  <a href="#license">License</a>
</p>

---

## About
This project strives to be an open-source framework, providing ready-to-use tool set for making web applications, 
related to 2D/3D graphics and physics simulation (mostly games), quickly and easily. There are plenty of cool libraries 
for in-browser games, such as [three.js](https://github.com/mrdoob/three.js) for rendering using WebGL, 
[ammo.js](https://github.com/kripken/ammo.js) for WebAssembly physics and many more: **gg-web-engine** is not going to 
compete with any of them and re-invent the bicycle, but rather work on top of such libraries: the developer, using 
**gg-web-engine**, will have full control on those libraries, besides the built-in **gg-web-engine** functionality. 
The core of the engine **DO NOT** rely on any specific library and the end product can be quickly switched from one 
stack of physics/rendering libraries to anothers or even have self-implemented own solutions by implementing simple 
bindings to **gg-web-engine** core.

## Vision
- The project is not going to provide low-level solutions for rendering, physics, sounds etc. but have the integration 
with other libraries for that
- The project is going to work with both 2D and 3D worlds
- The project provides ready-to-use common functionality: canvas, game world, rendering loop, physics ticks, key/mouse 
controls and many more down the road
- The project provides common entities: rigid primitive, cameras, raycast vehicle and many more down the road
- The project provides own way of serialization objects: has a built-in blender exporter which will export geometry
  and rigid body properties to files, seamlessly supported by the engine (**3D world only** for now)
- The project does not restrict developer from working with integrated libraries directly
- The project is written on [TypeScript](https://github.com/microsoft/TypeScript)
- The project is module-based ES6 code
- The project intensively uses [rxjs](https://github.com/ReactiveX/rxjs)

## Status
Pre-pre-alpha super-experimental release. I'll be happy to see any feature requests and bug reports in the 
[Issues](https://github.com/AndyGura/gg-web-engine/issues) and [Pull Requests](https://github.com/AndyGura/gg-web-engine/pulls) 
are more than welcome. This project is initialized with parts of my own attempt to implement replica of old NFS game
[The Need For Speed Web](https://tnfsw.guraklgames.com/) (far from final version), by the way it was using cannon.js 
and then migrated to ammo.js with minimum changes to the architecture, which in fact inspired me to start this project: 
there was a lot to learn and realize that game development for browsers deserves more than available. Right now the 
engine is still focused on that NFS project and all the functionality is written specifically for it, so one can notice 
that there is currently lack of functionality which is not related to racing games.

## Features

- Automatically working physics/rendering ticks
- Automatic physics body/visual mesh position/rotation binding
- Controllers interface, allowing to add some functions as part of tick
- keyboard controller, supports key bindings
- mouse controller, supports pointer lock
- rigid bodies
- trigger zones
- free-fly camera controller (3D world only)
- raycast car entity (3D world only) and dedicated keyboard controller for it
- map graph, allowing to load only nearest part of map, using graph of map areas (3D world only)
- UI dev console (enable console for world in your code and press ` at runtime)
- physics debugger renderer (3D world only)

## Integrations
Note: at this early step, the project does not give much flexibility in that regard, will be changed in future
- [**@gg-web-engine/three**](https://github.com/AndyGura/gg-web-engine/tree/main/packages/three) - 3D world rendering module [Three.js](https://github.com/mrdoob/three.js)
- [**@gg-web-engine/ammo**](https://github.com/AndyGura/gg-web-engine/tree/main/packages/ammo) - 3D world physics simulation module [Ammo.js](https://github.com/kripken/ammo.js)
- [**@gg-web-engine/pixi**](https://github.com/AndyGura/gg-web-engine/tree/main/packages/pixi) - 2D world rendering module [Pixi.js](https://github.com/pixijs/pixijs)
- [**@gg-web-engine/matter**](https://github.com/AndyGura/gg-web-engine/tree/main/packages/matter) - 2D world physics simulation module [Matter.js](https://github.com/liabru/matter-js)

## Quickstart
**Note: right now it does not provide CommonJS/UMD modules**
### Installation:
`npm install --save @gg-web-engine/core`<br/>
And install integration modules, for instance if I want to create 3D world:<br/>
`npm install --save @gg-web-engine/three`<br/>
`npm install --save @gg-web-engine/ammo`

Add to your `tsconfig.json` in the record `compilerOptions.paths` (example for three+ammo):
```json lines
"three": ["./node_modules/@gg-web-engine/three/node_modules/three"],
"mini-signals": ["./node_modules/@gg-web-engine/ammo/node_modules/mini-signals/index.js"],
"path": ["./node_modules/@gg-web-engine/ammo/node_modules/path-browserify"],
"fs": ["./node_modules/@gg-web-engine/ammo/node_modules/fs-web"],
"ammojs-typed": ["./node_modules/@gg-web-engine/ammo/node_modules/ammojs-typed"]
```
You can check all required paths per integration in their own README, check the <a href="#integrations">integrations list</a>

### Usage:
1) add somewhere in dom tree: ```<div id="gg-stage"></div>```
2) write bootstrap script, example:
```typescript
import { Gg3dEntity, Gg3dWorld, GgViewportManager, Qtrn } from '@gg-web-engine/core';
import { Gg3dVisualScene, GgRenderer } from '@gg-web-engine/three';
import { Gg3dPhysicsWorld } from '@gg-web-engine/ammo';

// create world
const world: Gg3dWorld = new Gg3dWorld(new Gg3dVisualScene(), new Gg3dPhysicsWorld());
await world.init();

// create viewport and renderer
const canvas = await GgViewportManager.instance.createCanvas(1);
const renderer: GgRenderer = new GgRenderer(canvas);
renderer.camera.position = { x: 15, y: 15, z: 9 };
renderer.camera.rotation = Qtrn.lookAt(renderer.camera.position, {x: 0, y: 0, z: 0}, {x: 0, y: 0, z: 1});
world.addEntity(renderer);
renderer.activate();

// create floor (static rigid body)
const floor = new Gg3dEntity(
  world.visualScene.factory.createBox({ x: 7, y: 7, z: 1 }),
  world.physicsWorld.factory.createRigidBody({
    shape: { shape: 'BOX', dimensions: { x: 7, y: 7, z: 1 } },
    body: { dynamic: false },
  }),
);
world.addEntity(floor);

// spawn cubes with mass 5kg twice a second
interval(500).subscribe(() => {
  // generate cube
  let item: Gg3dEntity = new Gg3dEntity(
    world.visualScene.factory.createBox({ x: 1, y: 1, z: 1 }),
    world.physicsWorld.factory.createRigidBody({
      shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } },
      body: { mass: 1 },
    }),
  );
  // set position to cube
  item.position = { x: Math.random() * 5 - 2.5, y: Math.random() * 5 - 2.5, z: 10 };
  world.addEntity(item);
  // delete cube from world after 30 seconds
  setTimeout(() => { world.removeEntity(item, true); }, 30000);
});

// start simulation
world.start();
```
And run it:
<p align="center">
  <img src="documentation/assets/example.gif" alt=''/>
</p>

## Examples
### [Fly city demo](https://gg-web-demos.guraklgames.com/index.html)
source code is available [here](https://github.com/AndyGura/gg-web-engine/tree/main/examples/fly-city)

Demos are not properly documented yet (and only one is deployed), please check [the code](https://github.com/AndyGura/gg-web-engine/tree/main/examples)

## Architecture
Technical documentation available at [GitHub Pages](https://andygura.github.io/gg-web-engine/)

## Support
You can help by giving any feedback, bug report, feature request to [Issues](https://github.com/AndyGura/gg-web-engine/issues) 
or help me directly by submitting a [Pull Request](https://github.com/AndyGura/gg-web-engine/pulls)

## License
[Apache License](LICENSE)
