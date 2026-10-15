import { Entity3d, Point3, Pnt3, Qtrn } from '@gg-web-engine/core';
import { ThreeGgWorld } from '@gg-web-engine/three';

/** The level JSON's `"Crystal"` config, with the entity's `position` merged in by the loader. */
export type CrystalSettings = { position: Point3; color: number; size?: number };

/**
 * The generator of the level's `"Crystal"` class (registered in game.screen.ts): a purely visual
 * entity, no physics body - two four-sided cones tip to tip make an octahedron, which spins and
 * bobs on every tick. Collecting one is a distance check in the game loop, so it needs no trigger.
 */
export function createCrystal(world: ThreeGgWorld, settings: CrystalSettings): Entity3d {
  const size = settings.size ?? 1;
  const half = { shape: 'CONE', radius: 0.28 * size, height: 0.4 * size, radialSegments: 4 } as const;
  const mesh = world.visualScene.factory.createPrimitive(
    {
      shape: 'COMPOUND',
      children: [
        { position: { x: 0, y: 0, z: 0.2 * size }, shape: half },
        // the lower half: the same cone, flipped upside down
        { position: { x: 0, y: 0, z: -0.2 * size }, rotation: Qtrn.fromAngle(Pnt3.X, Math.PI), shape: half },
      ],
    },
    { color: settings.color, shading: 'phong', castShadow: true },
  );
  const crystal = new Entity3d({ object3D: mesh });
  const home = settings.position;
  crystal.position = home;
  // a phase from the position, so neighbouring crystals don't bob in sync
  const phase = home.x + home.y;
  crystal.tick$.subscribe(([elapsed]) => {
    const t = elapsed / 1000;
    crystal.rotation = Qtrn.fromAngle(Pnt3.Z, t * 1.5 + phase);
    crystal.position = { ...home, z: home.z + Math.sin(t * 2 + phase) * 0.12 };
  });
  return crystal;
}
