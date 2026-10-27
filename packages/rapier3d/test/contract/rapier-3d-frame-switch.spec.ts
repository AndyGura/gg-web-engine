import { describeFrameSwitchContract } from '../../../core/test/contract/frame-switch.contract';
import { Rapier3dWorldComponent } from '../../src';

describeFrameSwitchContract('rapier3d', () => new Rapier3dWorldComponent(), {
  // no PLANE shape: a 2 km box with its top face at z = 0
  ground: { shape: { shape: 'BOX', dimensions: { x: 2000, y: 2000, z: 2 } }, position: { x: 0, y: 0, z: -1 } },
  // Rapier simulates in single precision. 15-21 km from the origin a coordinate has a 1-2 mm step,
  // so the far drive's position differs from the near-origin reference by ~14 cm at worst (heading
  // and speed stay within the acceptance thresholds). That is the precision there, not the switch:
  // applying the same two switches on the first two ticks, to a car at rest (the same as spawning
  // it there), differs by ~12 cm; the re-centring scenario, with the same yaws near the origin,
  // stays under 1 mm.
  farBounds: { position: 0.25, heading: 0.1, speed: 0.01 },
  report: (scenario, d) =>
    console.log(
      `frame switch deviations (rapier3d, ${scenario}): position ${d.position} m, heading ${d.heading} deg, ` +
        `speed ${d.speed} m/s, velocity ${d.velocity} m/s, wheels ${d.wheels} m`,
    ),
});
