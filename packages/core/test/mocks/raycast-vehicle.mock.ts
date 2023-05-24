import { CarProperties, Gg3dRaycastVehicleEntity, IGg3dRaycastVehicle } from '../../src';
import { mock3DObject } from './object.mock';

export const mockRaycastVehicleEntity: () => Gg3dRaycastVehicleEntity = () => new Gg3dRaycastVehicleEntity(mockCarProperties(), mock3DObject(), mockRaycastVehicle());

export const mockRaycastVehicle: () => IGg3dRaycastVehicle = () => {
  return {
    addWheel: () => {
    },
    setSteering: () => {
    },
  } as any;
};

export const mockCarProperties: () => CarProperties = () => ({
  mpsToRpmFactor: 104,
  wheelOptions: [
    {
      tyre_width: 1,
      tyre_radius: 1,
      isLeft: true,
      isFront: true,
      position: { x: -1, y: 1, z: 0 },
      frictionSlip: 0, // friction with road
      rollInfluence: 0,
      maxTravel: 0,
    },
    {
      tyre_width: 1,
      tyre_radius: 1,
      isLeft: false,
      isFront: true,
      position: { x: 1, y: 1, z: 0 },
      frictionSlip: 0, // friction with road
      rollInfluence: 0,
      maxTravel: 0,
    },
    {
      tyre_width: 1,
      tyre_radius: 1,
      isLeft: true,
      isFront: false,
      position: { x: -1, y: -1, z: 0 },
      frictionSlip: 0, // friction with road
      rollInfluence: 0,
      maxTravel: 0,
    },
    {
      tyre_width: 1,
      tyre_radius: 1,
      isLeft: false,
      isFront: false,
      position: { x: 1, y: -1, z: 0 },
      frictionSlip: 0, // friction with road
      rollInfluence: 0,
      maxTravel: 0,
    },
  ],
  typeOfDrive: 'FWD',
  engine: {
    minRpm: 700,
    maxRpm: 7240,
    maxRpmIncreasePerSecond: 8000,
    maxRpmDecreasePerSecond: 8000,
    torques: [
      { rpm: 1000, torque: 270 },
      { rpm: 1200, torque: 290 },
      { rpm: 1400, torque: 320 },
      { rpm: 1600, torque: 340 },
      { rpm: 1800, torque: 357 },
      { rpm: 2000, torque: 365 },
      { rpm: 2200, torque: 370 },
      { rpm: 2400, torque: 377 },
      { rpm: 2600, torque: 382 },
      { rpm: 2800, torque: 385 },
      { rpm: 3000, torque: 390 },
      { rpm: 3200, torque: 392 },
      { rpm: 3400, torque: 395 },
      { rpm: 3600, torque: 398 },
      { rpm: 3800, torque: 405 },
      { rpm: 4000, torque: 410 },
      { rpm: 4200, torque: 420 },
      { rpm: 4400, torque: 440 },
      { rpm: 4600, torque: 460 },
      { rpm: 4800, torque: 470 },
      { rpm: 5000, torque: 480 },
      { rpm: 5200, torque: 485 },
      { rpm: 5400, torque: 490 },
      { rpm: 5600, torque: 490 },
      { rpm: 5800, torque: 487 },
      { rpm: 6000, torque: 485 },
      { rpm: 6200, torque: 470 },
      { rpm: 6400, torque: 460 },
      { rpm: 6600, torque: 450 },
      { rpm: 6800, torque: 440 },
      { rpm: 7000, torque: 430 },
      { rpm: 7200, torque: 420 },
      { rpm: 7400, torque: 410 },
      { rpm: 7600, torque: 400 },
      { rpm: 7800, torque: 390 },
      { rpm: 8000, torque: 380 },
      { rpm: 8200, torque: 370 },
      { rpm: 8400, torque: 360 },
      { rpm: 8600, torque: 350 },
      { rpm: 8800, torque: 340 },
      { rpm: 9000, torque: 330 },
      { rpm: 9200, torque: 320 },
      { rpm: 9400, torque: 300 },
      { rpm: 9600, torque: 280 },
      { rpm: 9800, torque: 260 },
      { rpm: 10000, torque: 240 },
      { rpm: 10200, torque: 220 },
      { rpm: 10400, torque: 200 },
      { rpm: 10600, torque: 180 },
      { rpm: 10800, torque: 160 },
      { rpm: 11000, torque: 140 },
    ],
  },
  transmission: {
    isAuto: true,
    drivelineEfficiency: 0.85,
    finalDriveRatio: 3.21,
    reverseGearRatio: -2.33,
    gearRatios: [2.92, 1.87, 1.42, 1.09, 0.81],
    upShifts: [7140, 7140, 7140, 7140, 2829625512],
  },
  suspension: {
    stiffness: 20,
    damping: 2.3,
    compression: 4.4,
    restLength: 0.53,
  },
  brake: {
    frontAxleForce: 350,
    rearAxleForce: 300,
    handbrakeForce: 1500,
  }
});
