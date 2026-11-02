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

### Units

The adapter takes and reports the engine's units, the same as every other physics package: positions and
sizes in meters, velocities in m/s, angular velocity in rad/s, mass in kg, forces in N, impulses in N·s,
torque in N·m and gravity in m/s² (`{ x: 0, y: 9.82 }` by default, +Y pointing down the screen). matter-js
itself is tuned for bodies tens to hundreds of its own units across, so the adapter converts every
quantity at its boundary through one private constant (100 native units per meter). Only the native
objects it exposes - `MatterWorldComponent.matterEngine`/`matterWorld` and every component's
`nativeBody` - are in matter-js's native units.
