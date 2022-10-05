# gg-web-engine
### An attempt to create open source game engine for browser

Browser API nowadays is rich enough: with it's hardware accelerated rendering, WebAssembly, Service Workers and other features, it is technically capable of running games seamlessly inside the browser, without installation, drivers etc: you just open the game in your browser tab and play it. Well, there are many cool demos with 3D, physics, but too low amount of more or less complex games. After quick overview of demos and games for browser, one can notice, that the crucial problem in them is a code: even small demos usually have a huge js file, where it handles everything: key presses, rendering loop, physics simulation, binding physics object position to 3D mesh, game logic etc. It is obvious that such code is very hard to support, extend, and even understand what's going on.

This project is going to be the open-source framework, providing ready-to-use project structure and minimum tool set for making game building quickly and easily. There are plenty of cool libraries for in-browser games, such as [three.js](https://github.com/mrdoob/three.js) for rendering using WebGL, [ammo.js](https://github.com/kripken/ammo.js) for WebAssembly physics and many more: the **gg-web-engine** is not going to compete with any of them and re-invent the bicycle, but rather work on top of such libraries: the developer, using **gg-web-engine**, will have full control on those libraries, besides the built-in **gg-web-engine** functionality.

## Project vision notes:
- The project is not going to provide low-level solutions for rendering, physics, sounds etc. but have the integration with other libraries for that
- The project provides ready-to-use common functionality: canvas, game world, rendering loop, physics ticks, key/mouse controls, LOD system etc.
- The project initially works with [three.js](https://github.com/mrdoob/three.js) + [ammo.js](https://github.com/kripken/ammo.js), but it is designed to support multiple of them later on
- The project does not restrict developer from working with integrated libraries (three.js/ammo.js) directly
- The project is written on [TypeScript](https://github.com/microsoft/TypeScript)
- The project is module-based, so games will not have unneeded functionality in the final build
- The project provides common actors: rigid primitive, cameras, raycast vehicle etc.
- The project intensively uses [rxjs](https://github.com/ReactiveX/rxjs)
- The project provides own way of serialization objects: has a built-in blender exporter which will export geometry, materials, animations, bones and physics properties directly to the engine

## Project status:
Logging dreams to github, no code yet :) At first step, I'm going to pull some part of code from my [TheNeedForSpeedWeb](https://tnfsw.guraklgames.com/) project, which by the way was using cannon.js and then migrated to ammo.js with minimum changes to the architecture
