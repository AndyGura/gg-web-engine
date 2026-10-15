import { EntityJson, LevelJson, Point3, Point4, Qtrn } from '@gg-web-engine/core';

// The race track, described as data: a stadium-shaped loop (two straights joined by two half
// circles), walled in on both sides, with checkpoint triggers spaced around it. Every peer builds it
// itself from this file (`net.loadSharedLevel` in index.ts), so it is shared content: its entities
// have the same names everywhere and none of them is ever sent over the network.
//
// The world is Z-up: {x, y} is the ground, +Z is up. Sizes are meters.

/** Half the length of each straight, meters. */
const HALF_STRAIGHT = 60;
/** Radius of the track's centerline in the two turns. */
const TURN_RADIUS = 36;
/** Width of the driving surface, wall to wall. */
export const TRACK_WIDTH = 16;
/** How many checkpoint gates there are around the loop; gate 0 is the start/finish line. */
export const CHECKPOINTS = 8;

const TURN_PIECES = 18; // wall and asphalt pieces per half circle
const WALL_HEIGHT = 1.2;
const WALL_THICKNESS = 1;
const STATIC = { bodyType: 'static', mass: 0, friction: 0.4, restitution: 0.1 } as const;
const LENGTH = 4 * HALF_STRAIGHT + 2 * Math.PI * TURN_RADIUS;

/** A point on the track's centerline and the direction of travel there (radians, from +X). */
export type TrackPose = { position: Point3; heading: number };

/**
 * The centerline at distance `s` (meters) from the start/finish line, driving counterclockwise:
 * along the bottom straight towards +X, around the right turn, back along the top straight, around
 * the left turn.
 */
export function poseAt(s: number): TrackPose {
  s = ((s % LENGTH) + LENGTH) % LENGTH;
  const turn = Math.PI * TURN_RADIUS;
  const legs: [number, (d: number) => TrackPose][] = [
    [HALF_STRAIGHT, d => ({ position: { x: d, y: -TURN_RADIUS, z: 0 }, heading: 0 })],
    [turn, d => arc(HALF_STRAIGHT, -Math.PI / 2 + d / TURN_RADIUS)],
    [2 * HALF_STRAIGHT, d => ({ position: { x: HALF_STRAIGHT - d, y: TURN_RADIUS, z: 0 }, heading: Math.PI })],
    [turn, d => arc(-HALF_STRAIGHT, Math.PI / 2 + d / TURN_RADIUS)],
    [HALF_STRAIGHT, d => ({ position: { x: -HALF_STRAIGHT + d, y: -TURN_RADIUS, z: 0 }, heading: 0 })],
  ];
  for (const [length, at] of legs) {
    if (s <= length) return at(s);
    s -= length;
  }
  return legs[0][1](0);

  function arc(centerX: number, angle: number): TrackPose {
    return {
      position: { x: centerX + Math.cos(angle) * TURN_RADIUS, y: Math.sin(angle) * TURN_RADIUS, z: 0 },
      heading: angle + Math.PI / 2,
    };
  }
}

/** Where checkpoint `index` sits on the loop, meters from the start/finish line. */
export const checkpointDistance = (index: number) => (index * LENGTH) / CHECKPOINTS;

/**
 * The rotation of a car facing `heading`. The car's forward axis is +Y, so it turns a quarter less
 * than the heading measured from +X.
 */
export const carRotation = (heading: number): Point4 => Qtrn.fromEuler({ x: 0, y: 0, z: heading - Math.PI / 2 });

/**
 * Starting grid slot `index`: two columns behind the start/finish line, every row a car length and
 * a half further back.
 */
export function gridSlot(index: number): { position: Point3; rotation: Point4 } {
  const row = Math.floor(index / 2);
  const side = index % 2 === 0 ? 1 : -1;
  return {
    position: { x: -10 - row * 8, y: -TURN_RADIUS + side * (TRACK_WIDTH / 4), z: 0.8 },
    rotation: carRotation(0),
  };
}

/** A spot in the infield, off the track, where a player waits for the next race to start. */
export function benchSlot(index: number): { position: Point3; rotation: Point4 } {
  return {
    position: { x: -40 + (index % 8) * 11, y: -6 + Math.floor(index / 8) * 8, z: 0.8 },
    rotation: carRotation(0),
  };
}

function box(
  name: string,
  position: Point3,
  heading: number,
  dimensions: Point3,
  color: number,
  castShadow = true,
): EntityJson {
  return {
    class: 'Primitive',
    shape: 'BOX',
    name,
    position,
    rotation: Qtrn.fromEuler({ x: 0, y: 0, z: heading }),
    config: {
      dimensions,
      material: { color, shading: 'standart', receiveShadow: true, castShadow },
      body: STATIC,
    },
  };
}

/** `pose`'s point moved sideways by `offset` meters: positive is to the left of the direction of travel. */
function side(pose: TrackPose, offset: number, z: number): Point3 {
  return {
    x: pose.position.x - Math.sin(pose.heading) * offset,
    y: pose.position.y + Math.cos(pose.heading) * offset,
    z,
  };
}

// --- walls and asphalt: one long piece per straight, TURN_PIECES pieces per turn. The inner wall
// of each turn alternates red and white like a kerb.
const surface: EntityJson[] = [];
const wallOffset = TRACK_WIDTH / 2 + WALL_THICKNESS / 2;
let piece = 0;
const addPiece = (from: number, length: number, curved: boolean) => {
  const pose = poseAt(from + length / 2);
  // on a curve, a piece is a chord of its own circle: longer outside, shorter inside, plus a little
  // overlap so neighbors leave no gap. Driving counterclockwise, the left side faces the turn's
  // center, so a positive (left) offset is the smaller radius.
  const scale = (offset: number) => (curved ? (TURN_RADIUS - offset) / TURN_RADIUS : 1);
  const overlap = curved ? 0.6 : 0;
  const n = piece++;
  surface.push(
    box(
      `Asphalt_${n}`,
      side(pose, 0, -0.05),
      pose.heading,
      { x: length * scale(-TRACK_WIDTH / 2) + overlap, y: TRACK_WIDTH + 0.2, z: 0.1 },
      0x3b3f45,
      false,
    ),
    box(
      `WallLeft_${n}`,
      side(pose, wallOffset, WALL_HEIGHT / 2),
      pose.heading,
      { x: length * scale(wallOffset) + overlap, y: WALL_THICKNESS, z: WALL_HEIGHT },
      curved ? (n % 2 ? 0xffffff : 0xd7263d) : 0xe0e0e0,
    ),
    box(
      `WallRight_${n}`,
      side(pose, -wallOffset, WALL_HEIGHT / 2),
      pose.heading,
      { x: length * scale(-wallOffset) + overlap, y: WALL_THICKNESS, z: WALL_HEIGHT },
      0x2e86ab,
    ),
  );
};
{
  const turn = Math.PI * TURN_RADIUS;
  let s = 0;
  addPiece(s, HALF_STRAIGHT, false);
  s += HALF_STRAIGHT;
  for (let i = 0; i < TURN_PIECES; i++, s += turn / TURN_PIECES) addPiece(s, turn / TURN_PIECES, true);
  addPiece(s, 2 * HALF_STRAIGHT, false);
  s += 2 * HALF_STRAIGHT;
  for (let i = 0; i < TURN_PIECES; i++, s += turn / TURN_PIECES) addPiece(s, turn / TURN_PIECES, true);
  addPiece(s, HALF_STRAIGHT, false);
}

// --- checkpoints: trigger volumes across the track. A car has to pass them in order; gate 0 is
// the start/finish line.
const checkpoints: EntityJson[] = Array.from({ length: CHECKPOINTS }, (_, i) => {
  const pose = poseAt(checkpointDistance(i));
  return {
    class: 'Trigger',
    name: `Checkpoint_${i}`,
    position: side(pose, 0, 1.5),
    rotation: Qtrn.fromEuler({ x: 0, y: 0, z: pose.heading }),
    config: { dimensions: { x: 1, y: TRACK_WIDTH, z: 3 } },
  };
});

// --- the start/finish line: a checkered strip on the asphalt and a gantry over it
const SQUARE = TRACK_WIDTH / 8;
const finishLine: EntityJson[] = [];
for (let row = 0; row < 2; row++) {
  for (let col = 0; col < 8; col++) {
    finishLine.push(
      box(
        `Finish_${row}_${col}`,
        { x: (row - 0.5) * SQUARE, y: -TURN_RADIUS - TRACK_WIDTH / 2 + (col + 0.5) * SQUARE, z: 0.005 },
        0,
        { x: SQUARE, y: SQUARE, z: 0.01 },
        (row + col) % 2 ? 0x111111 : 0xffffff,
        false,
      ),
    );
  }
}
finishLine.push(
  box('GantryLeft', { x: 0, y: -TURN_RADIUS + wallOffset + 1, z: 3.5 }, 0, { x: 0.6, y: 0.6, z: 7 }, 0x444444),
  box('GantryRight', { x: 0, y: -TURN_RADIUS - wallOffset - 1, z: 3.5 }, 0, { x: 0.6, y: 0.6, z: 7 }, 0x444444),
  box('GantryBanner', { x: 0, y: -TURN_RADIUS, z: 6.6 }, 0, { x: 0.5, y: TRACK_WIDTH + 4, z: 1.2 }, 0xd7263d),
);

export const track: LevelJson = {
  entities: [
    {
      class: 'Environment',
      name: 'Sky',
      config: { background: 0x9fc7e8, fog: { type: 'LINEAR', color: 0x9fc7e8, near: 120, far: 320 } },
    },
    {
      class: 'Light',
      name: 'Ambient',
      config: { type: 'HEMISPHERE', color: 0xffffff, groundColor: 0x445533, intensity: 1.2 },
    },
    {
      class: 'Light',
      name: 'Sun',
      position: { x: 40, y: -30, z: 80 },
      config: {
        type: 'DIRECTIONAL',
        intensity: 2,
        castShadow: true,
        shadow: { mapSize: 4096, area: 130 },
        target: { x: 0, y: 0, z: 0 },
      },
    },
    box('Grass', { x: 0, y: 0, z: -0.5 }, 0, { x: 400, y: 300, z: 0.8 }, 0x5a7d4a, false),
    ...surface,
    ...finishLine,
    ...checkpoints,
  ],
};
