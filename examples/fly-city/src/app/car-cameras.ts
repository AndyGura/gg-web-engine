import { averageAngle, MotionControlFunction, Gg3dRaycastVehicleEntity, Pnt3, Point3, Qtrn } from '@gg-web-engine/core';

const elasticAngle: (inertia: number, easing?: (x: number) => number) => ((value: number, deltaMs: number) => number) =
  (inertia: number, easing: ((x: number) => number) = x => x) => {
    let latestValue: number | null = null;
    return (value, deltaMs) => {
      if (latestValue !== null) {
        let newFactor = easing(deltaMs / inertia);
        if (newFactor < 1) {
          value = averageAngle(latestValue, value, newFactor);
        }
      }
      latestValue = value;
      return value;
    };
  };

const elasticCarCameraControlFunction: (car: Gg3dRaycastVehicleEntity, vectorLength: number, vectorAngle: number, fov: number) => MotionControlFunction =
  (car: Gg3dRaycastVehicleEntity, vectorLength: number, vectorAngle: number, fov: number) => {
    const elasticZAngle = elasticAngle(250, x => Math.pow(x, 0.75));
    return (delta) => {
      const objectPosition = car.position;
      const carVector = Pnt3.rot({ x: 0, y: 1, z: 0 }, car.rotation);
      // FIXME jitters when turning during FPS drop, but elasticZAngle calculation is correct
      const zAngle = elasticZAngle(Math.atan2(carVector.y, carVector.x) - Math.PI / 2, delta);
      const cameraVector = Pnt3.rotAround(
        Pnt3.rotAround(
          { x: 0, y: -vectorLength, z: 0 },
          { x: 1, y: 0, z: 0 },
          -vectorAngle
        ),
        { x: 0, y: 0, z: 1 },
        zAngle
      );
      let cameraTargetVector = { x: 0, y: 0, z: vectorLength * Math.sin(vectorAngle) };
      const position = Pnt3.add(objectPosition, cameraVector);
      return {
        position,
        rotation: Qtrn.lookAt(
          position,
          Pnt3.add(objectPosition, cameraTargetVector),
          Pnt3.norm(cameraTargetVector),
        ),
        customParameters: {
          fov,
        },
      };
    }
  };

const lockedCameraControlFunction: (car: Gg3dRaycastVehicleEntity, cameraPosition: Point3, targetPosition: Point3, fov: number) => MotionControlFunction =
  (car: Gg3dRaycastVehicleEntity, cameraPosition: Point3, targetPosition: Point3, fov: number) => {
    return () => {
      const objectPosition = car.position;
      const rotation = car.rotation;
      const cameraVector = Pnt3.rot(cameraPosition, rotation);
      const cameraTargetVector = Pnt3.rot(targetPosition, rotation);
      const cameraUpVector = Pnt3.rot({ x: 0, y: 0, z: 1 }, rotation);

      const position = Pnt3.add(objectPosition, cameraVector);
      return {
        position,
        rotation: Qtrn.lookAt(
          position,
          Pnt3.add(objectPosition, cameraTargetVector),
          cameraUpVector,
        ),
        customParameters: {
          fov,
        },
      };
    }
  };

export const farCamera: (car: Gg3dRaycastVehicleEntity) => MotionControlFunction = (car) => {
  return elasticCarCameraControlFunction(car, 6.5, 0.3948, 65);
};

export const nearCamera: (car: Gg3dRaycastVehicleEntity) => MotionControlFunction = (car) => {
  return elasticCarCameraControlFunction(car, 4.09, 0.376, 80);
};

export const bumperCamera: (car: Gg3dRaycastVehicleEntity) => MotionControlFunction = (car) => {
  return lockedCameraControlFunction(car, { x: 0, y: 1, z: 0.7 }, { x: 0, y: 2, z: 0.7 }, 70);
};
