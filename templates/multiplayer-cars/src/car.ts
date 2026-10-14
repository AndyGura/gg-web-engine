import {
  createInlineTickController,
  EntityJson,
  IPositionable3d,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  Renderer3dEntity,
  TickOrder,
} from '@gg-web-engine/core';

/**
 * A procedural car (box chassis, cylinder wheels) as an entity description for the built-in
 * `"GgCar"` level class. The car's forward axis is +Y, up is +Z.
 *
 * Tuning numbers: a 900 kg car, ~300 N·m, automatic gearbox. See `GgCarProperties` in the engine
 * docs for what each field means.
 */
export function carJson(name: string, position: Point3, rotation: Point4, color: number): EntityJson {
  return {
    class: 'GgCar',
    name,
    position,
    rotation,
    config: {
      chassis: {
        dimensions: { x: 1.8, y: 4, z: 0.6 },
        material: { color, shading: 'standart', castShadow: true },
        body: { mass: 900 },
      },
      wheelBase: {
        shared: {
          frictionSlip: 1.2,
          rollInfluence: 0.2,
          display: { material: { color: 0x222222, shading: 'standart', castShadow: true }, wheelObjectDirection: 'z' },
        },
        front: { halfAxleWidth: 1, axlePosition: 1.4, axleHeight: 0.3, tyreRadius: 0.35, tyreWidth: 0.25 },
        rear: { halfAxleWidth: 1, axlePosition: -1.3, axleHeight: 0.3, tyreRadius: 0.38, tyreWidth: 0.3 },
      },
      suspension: { stiffness: 20, damping: 2.3, compression: 4.4, restLength: 0.53 },
      tractionBias: 0,
      engine: {
        minRpm: 900,
        maxRpm: 7000,
        torques: [
          { rpm: 1000, torque: 260 },
          { rpm: 4500, torque: 320 },
          { rpm: 7000, torque: 280 },
        ],
        maxRpmIncreasePerSecond: 8000,
        maxRpmDecreasePerSecond: 8000,
      },
      brake: { frontAxleForce: 2650, rearAxleForce: 1770, handbrakeForce: 4500 },
      transmission: {
        isAuto: true,
        drivelineEfficiency: 0.85,
        finalDriveRatio: 3.21,
        reverseGearRatio: -2.33,
        gearRatios: [2.92, 1.87, 1.42, 1.09, 0.81],
        upShifts: [6500, 6500, 6500, 6500, 6500],
        downshiftMargin: 1500,
        autoHold: false,
      },
      maxSteerAngle: [
        { atSpeedMs: 5, angleRad: 0.5 },
        { atSpeedMs: 30, angleRad: 0.15 },
      ],
      rollingResistance: 0.012,
      aerodynamics: { dragCoefficient: 0.32, frontalArea: 2.1 },
    },
  };
}

/**
 * A smoothed third-person camera behind `target`. Runs after physics and before rendering
 * (`TickOrder.CONTROLLERS`), so it reads this tick's car position. `renderer` must already be in
 * the world. Returns a function that stops following.
 */
export function followWithChaseCamera(renderer: Renderer3dEntity, target: IPositionable3d): () => void {
  const world = renderer.world;
  if (!world) throw new Error('followWithChaseCamera: add the renderer to the world first');
  const DISTANCE = 7; // meters behind
  const HEIGHT = 3; // meters above
  const STIFFNESS = 4; // per second; higher = tighter follow
  let camera = renderer.position;
  const sub = createInlineTickController(world, TickOrder.CONTROLLERS, 'ChaseCamera').subscribe(([, dt]) => {
    const forward = Pnt3.rot(Pnt3.Y, target.rotation);
    // keep the camera level even when the car pitches over a ramp
    const flat = Pnt3.norm({ x: forward.x, y: forward.y, z: 0 });
    const desired = Pnt3.add(
      target.position,
      Pnt3.add(Pnt3.scalarMult(flat, -DISTANCE), Pnt3.scalarMult(Pnt3.Z, HEIGHT)),
    );
    camera = Pnt3.lerp(camera, desired, 1 - Math.exp((-STIFFNESS * dt) / 1000));
    renderer.position = camera;
    renderer.rotation = Qtrn.lookAt(camera, Pnt3.add(target.position, Pnt3.scalarMult(Pnt3.Z, 1)));
  });
  return () => sub.unsubscribe();
}
