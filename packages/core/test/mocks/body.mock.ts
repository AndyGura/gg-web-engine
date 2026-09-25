import { Subject } from 'rxjs';
import {
  BodyOptions,
  DebugBody2DSettings,
  DebugBody3DSettings,
  IRigidBody2dComponent,
  IRigidBody3dComponent,
  Shape2DDescriptor,
  Shape3DDescriptor,
} from '../../src';

const defaultBodyOptions: BodyOptions = {
  bodyType: 'dynamic',
  mass: 1,
  restitution: 0.2,
  friction: 0.5,
  ownCollisionGroups: [0],
  interactWithCollisionGroups: [0],
  ccd: false,
};

export const mock2DBody = (
  shape: Shape2DDescriptor = { shape: 'SQUARE', dimensions: { x: 1, y: 1 } },
  bodyOptions: BodyOptions = defaultBodyOptions,
) => {
  return {
    entity: null,
    position: { x: 0, y: 0 },
    rotation: 0,
    linearVelocity: { x: 0, y: 0 },
    angularVelocity: 0,
    ownCollisionGroups: [0],
    interactWithCollisionGroups: [0],
    name: '',
    debugBodySettings: new DebugBody2DSettings({ type: 'RIGID_DYNAMIC', sleeping: () => false }, shape),
    bodyOptions,
    onCollisionStart: new Subject(),
    onCollisionEnd: new Subject(),
    addToWorld() {
    },
    removeFromWorld() {
    },
    dispose() {
    },
  } as unknown as IRigidBody2dComponent;
};

export const mock3DBody = (
  shape: Shape3DDescriptor = { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } },
  bodyOptions: BodyOptions = defaultBodyOptions,
) => {
  return {
    entity: null,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    linearVelocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    ownCollisionGroups: [0],
    interactWithCollisionGroups: [0],
    name: '',
    debugBodySettings: new DebugBody3DSettings({ type: 'RIGID_DYNAMIC', sleeping: () => false }, shape),
    bodyOptions,
    onCollisionStart: new Subject(),
    onCollisionEnd: new Subject(),
    addToWorld() {
    },
    removeFromWorld() {
    },
    dispose() {
    },
  } as unknown as IRigidBody3dComponent;
};
