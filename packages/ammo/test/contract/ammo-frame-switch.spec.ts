import { describeFrameSwitchContract } from '../../../core/test/contract/frame-switch.contract';
import { AmmoWorldComponent } from '../../src';

describeFrameSwitchContract('ammo', () => new AmmoWorldComponent(), {
  // ammo.js is a single-precision Bullet build. 15-21 km from the origin a coordinate has a 1-2 mm
  // step, so the far drive differs from the near-origin reference by ~3 cm, ~0.14 deg and ~6 cm/s
  // at worst. That is the precision there, not the switch: applying the same two switches on the
  // first two ticks, to a car at rest (the same as spawning it there), differs by as much (~5 cm,
  // ~0.13 deg, ~6 cm/s); the re-centring scenario, with the same yaws near the origin, stays within
  // ~2 mm, and an identity switch changes nothing at all.
  farBounds: { position: 0.05, heading: 0.25, speed: 0.1 },
  report: (scenario, d) =>
    console.log(
      `frame switch deviations (ammo, ${scenario}): position ${d.position} m, heading ${d.heading} deg, ` +
        `speed ${d.speed} m/s, velocity ${d.velocity} m/s, wheels ${d.wheels} m`,
    ),
});
