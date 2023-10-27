import { IRigidBody2dComponent, IRigidBody3dComponent } from '../../src';

export const mock2DBody = () => {
  return {
    position: { x: 0, y: 0 },
    rotation: 0,
    name: '',
    dispose() {
    },
  } as IRigidBody2dComponent;
};

export const mock3DBody = () => {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    name: '',
    dispose() {
    },
  } as IRigidBody3dComponent;
};
