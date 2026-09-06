import { ICharacterController3dComponent, Pnt3, Point3 } from '../../src';

/**
 * Governs what a mocked `move()` call resolves to - defaults to "apply the desired translation in
 * full and stay grounded", overridable per test (e.g. to simulate hitting a wall, or falling).
 */
export type MockCharacterControllerBehavior = {
  resolveMove?: (
    desiredTranslation: Point3,
    current: { position: Point3; isGrounded: boolean },
  ) => { appliedTranslation: Point3; isGrounded: boolean; groundNormal?: Point3 | null };
};

export const mockCharacterController = (
  radius: number = 0.4,
  centersDistance: number = 1.0,
  behavior: MockCharacterControllerBehavior = {},
  initialGrounded: boolean = true,
): ICharacterController3dComponent => {
  return {
    entity: null,
    name: 'mock-character-controller',
    radius,
    centersDistance,
    up: Pnt3.Z,
    position: Pnt3.O,
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    isGrounded: initialGrounded,
    groundNormal: Pnt3.Z,
    ownCollisionGroups: 'all',
    interactWithCollisionGroups: 'all',
    debugBodySettings: {},
    move(this: any, desiredTranslation: Point3) {
      const resolve =
        behavior.resolveMove ??
        (() => ({ appliedTranslation: desiredTranslation, isGrounded: true, groundNormal: Pnt3.Z }));
      const result = resolve(desiredTranslation, { position: this.position, isGrounded: this.isGrounded });
      this.position = Pnt3.add(this.position, result.appliedTranslation);
      this.isGrounded = result.isGrounded;
      this.groundNormal = result.groundNormal ?? null;
    },
    clone() {
      return mockCharacterController(radius, centersDistance, behavior);
    },
    addToWorld() {},
    removeFromWorld() {},
    dispose() {},
  } as unknown as ICharacterController3dComponent;
};
