import { ICharacterController2dComponent, Pnt2, Point2 } from '../../src';

/**
 * Governs what a mocked `move()` call resolves to - defaults to "apply the desired translation in
 * full and stay grounded", overridable per test (e.g. to simulate hitting a wall, or falling).
 * Mirrors `MockCharacterControllerBehavior` (3D).
 */
export type MockCharacterController2dBehavior = {
  resolveMove?: (
    desiredTranslation: Point2,
    current: { position: Point2; isGrounded: boolean },
  ) => { appliedTranslation: Point2; isGrounded: boolean; groundNormal?: Point2 | null };
};

export const mockCharacterController2d = (
  radius: number = 0.4,
  centersDistance: number = 1.0,
  behavior: MockCharacterController2dBehavior = {},
  initialGrounded: boolean = true,
): ICharacterController2dComponent => {
  return {
    entity: null,
    name: '',
    radius,
    centersDistance,
    up: Pnt2.nY,
    position: Pnt2.O,
    rotation: 0,
    isGrounded: initialGrounded,
    groundNormal: Pnt2.nY,
    ownCollisionGroups: 'all',
    interactWithCollisionGroups: 'all',
    ignoredBodies: new Set(),
    debugBodySettings: {},
    move(this: any, desiredTranslation: Point2) {
      const resolve =
        behavior.resolveMove ??
        (() => ({ appliedTranslation: desiredTranslation, isGrounded: true, groundNormal: Pnt2.nY }));
      const result = resolve(desiredTranslation, { position: this.position, isGrounded: this.isGrounded });
      this.position = Pnt2.add(this.position, result.appliedTranslation);
      this.isGrounded = result.isGrounded;
      this.groundNormal = result.groundNormal ?? null;
    },
    clone() {
      return mockCharacterController2d(radius, centersDistance, behavior);
    },
    addToWorld() {},
    removeFromWorld() {},
    dispose() {},
  } as unknown as ICharacterController2dComponent;
};
