import {
  AnimationFunction,
  averageAngle,
  Camera3dAnimationArgs,
  RaycastVehicle3dEntity,
  Pnt3,
  Point3,
} from '@gg-web-engine/core';

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

const elasticCarCameraControlFunction: (car: RaycastVehicle3dEntity, vectorLength: number, vectorAngle: number, fov: number) => AnimationFunction<Camera3dAnimationArgs> =
  (car: RaycastVehicle3dEntity, vectorLength: number, vectorAngle: number, fov: number) => {
    const elasticZAngle = elasticAngle(250, x => Math.pow(x, 0.75));
    return (elapsed, delta) => {
      const objectPosition = car.position;
      const carVector = Pnt3.rot(Pnt3.Y, car.rotation);
      // FIXME jitters when turning during FPS drop, but elasticZAngle calculation is correct
      const zAngle = elasticZAngle(Math.atan2(carVector.y, carVector.x) - Math.PI / 2, delta);
      const cameraVector = Pnt3.rotAround(
        Pnt3.rotAround(
          { x: 0, y: -vectorLength, z: 0 },
          Pnt3.X,
          -vectorAngle,
        ),
        Pnt3.Z,
        zAngle,
      );
      let cameraTargetVector = { x: 0, y: 0, z: vectorLength * Math.sin(vectorAngle) };
      return {
        position: Pnt3.add(objectPosition, cameraVector),
        target: Pnt3.add(objectPosition, cameraTargetVector),
        up: Pnt3.norm(cameraTargetVector),
        fov,
      };
    };
  };

const lockedCameraControlFunction: (car: RaycastVehicle3dEntity, cameraPosition: Point3, targetPosition: Point3, fov: number) => AnimationFunction<Camera3dAnimationArgs> =
  (car: RaycastVehicle3dEntity, cameraPosition: Point3, targetPosition: Point3, fov: number) => {
    return () => {
      const objectPosition = car.position;
      const rotation = car.rotation;
      const cameraVector = Pnt3.rot(cameraPosition, rotation);
      const cameraTargetVector = Pnt3.rot(targetPosition, rotation);
      return {
        position: Pnt3.add(objectPosition, cameraVector),
        target: Pnt3.add(objectPosition, cameraTargetVector),
        up: Pnt3.rot(Pnt3.Z, rotation),
        fov,
      };
    };
  };

export const farCamera: (car: RaycastVehicle3dEntity, type: 'lambo' | 'truck' | 'car') => AnimationFunction<Camera3dAnimationArgs> = (car, type) => {
  if (type === 'lambo') {
    return elasticCarCameraControlFunction(car, 6.5, 0.3948, 65);
  } else if (type === 'car') {
    return elasticCarCameraControlFunction(car, 9, 0.3948, 65);
  } else {
    return elasticCarCameraControlFunction(car, 22, 0.4448, 65);
  }
};

export const nearCamera: (car: RaycastVehicle3dEntity, type: 'lambo' | 'truck' | 'car') => AnimationFunction<Camera3dAnimationArgs> = (car, type) => {
  if (type === 'lambo') {
    return elasticCarCameraControlFunction(car, 4.09, 0.376, 80);
  } else if (type === 'car') {
    return elasticCarCameraControlFunction(car, 6, 0.476, 80);
  } else {
    return elasticCarCameraControlFunction(car, 9, 0.576, 80);
  }
};

export const bumperCamera: (car: RaycastVehicle3dEntity, type: 'lambo' | 'truck' | 'car') => AnimationFunction<Camera3dAnimationArgs> = (car, type) => {
  if (type === 'lambo') {
    return lockedCameraControlFunction(car, { x: 0, y: 1, z: 0.7 }, { x: 0, y: 2, z: 0.7 }, 70);
  } else if (type === 'car') {
    return lockedCameraControlFunction(car, { x: 0, y: 1, z: 1.2 }, { x: 0, y: 2, z: 1.2 }, 70);
  } else {
    return lockedCameraControlFunction(car, { x: 0, y: 1.3, z: 2.5 }, { x: 0, y: 2, z: 2.5 }, 70);
  }
};
