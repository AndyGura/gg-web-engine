import { CharacterAnimation2dController, CharacterController2dEntity } from '../../../../src';
import { mockCharacterController2d } from '../../../mocks/character-controller-2d.mock';
import { mock2DObject, mockAnimatedObject2d } from '../../../mocks/object.mock';

const clips = ['idle', 'walk', 'run', 'crouch', 'jump'];

describe('CharacterAnimation2dController', () => {
  it('plays "idle" by default when grounded and not moving', () => {
    const object2D = mockAnimatedObject2d(clips);
    const character = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, object2D, mockCharacterController2d());
    character.onSpawned({} as any);
    const controller = new CharacterAnimation2dController(character);
    controller.onSpawned({} as any);

    controller.tick$.next([1000, 16]);

    expect(object2D.currentAnimationName).toBe('idle');
  });

  it('switches to "walk"/"run" based on moveDirection and isRunning', () => {
    const object2D = mockAnimatedObject2d(clips);
    const character = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, object2D, mockCharacterController2d());
    character.onSpawned({} as any);
    const controller = new CharacterAnimation2dController(character);
    controller.onSpawned({} as any);

    character.moveDirection = 1;
    controller.tick$.next([1000, 16]);
    expect(object2D.currentAnimationName).toBe('walk');

    character.isRunning = true;
    controller.tick$.next([1016, 16]);
    expect(object2D.currentAnimationName).toBe('run');
  });

  it('switches to "crouch" while crouching, regardless of movement', () => {
    const object2D = mockAnimatedObject2d(clips);
    const cc = mockCharacterController2d();
    const character = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, object2D, cc);
    character.onSpawned({} as any);
    const controller = new CharacterAnimation2dController(character);
    controller.onSpawned({} as any);

    character.isCrouching = true;
    controller.tick$.next([1000, 16]);

    expect(object2D.currentAnimationName).toBe('crouch');
  });

  it('switches to "jump" whenever the character is airborne, taking priority over crouch', () => {
    const object2D = mockAnimatedObject2d(clips);
    const cc = mockCharacterController2d(0.4, 1, {}, false);
    const character = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, object2D, cc);
    character.onSpawned({} as any);
    const controller = new CharacterAnimation2dController(character);
    controller.onSpawned({} as any);

    controller.tick$.next([1000, 16]);

    expect(object2D.currentAnimationName).toBe('jump');
  });

  it('only calls playAnimation when the resolved state actually changes', () => {
    const object2D = mockAnimatedObject2d(clips);
    const character = new CharacterController2dEntity(
      { radius: 0.4, centersDistance: 1 },
      object2D,
      mockCharacterController2d(),
    );
    character.onSpawned({} as any);
    const controller = new CharacterAnimation2dController(character);
    controller.onSpawned({} as any);

    controller.tick$.next([1000, 16]);
    controller.tick$.next([1016, 16]);
    controller.tick$.next([1032, 16]);

    expect(object2D.playCalls.length).toBe(1);
    expect(object2D.playCalls[0].name).toBe('idle');
  });

  it('respects a custom clipMap override', () => {
    const object2D = mockAnimatedObject2d(['Idle_Loop']);
    const character = new CharacterController2dEntity(
      { radius: 0.4, centersDistance: 1 },
      object2D,
      mockCharacterController2d(),
    );
    character.onSpawned({} as any);
    const controller = new CharacterAnimation2dController(character, { clipMap: { idle: 'Idle_Loop' } });
    controller.onSpawned({} as any);

    controller.tick$.next([1000, 16]);

    expect(object2D.currentAnimationName).toBe('Idle_Loop');
  });

  it('does not switch state when the resolved clip name is missing from the sprite', () => {
    const object2D = mockAnimatedObject2d(['walk']); // no "idle" clip
    const character = new CharacterController2dEntity(
      { radius: 0.4, centersDistance: 1 },
      object2D,
      mockCharacterController2d(),
    );
    character.onSpawned({} as any);
    const controller = new CharacterAnimation2dController(character);
    controller.onSpawned({} as any);

    controller.tick$.next([1000, 16]);

    expect(object2D.currentAnimationName).toBeNull();
    expect(object2D.playCalls.length).toBe(0);
  });

  it('is a no-op (does not throw) when object2D is not an animated display object', () => {
    const object2D = mock2DObject();
    const character = new CharacterController2dEntity(
      { radius: 0.4, centersDistance: 1 },
      object2D,
      mockCharacterController2d(),
    );
    character.onSpawned({} as any);
    const controller = new CharacterAnimation2dController(character);
    controller.onSpawned({} as any);

    expect(() => controller.tick$.next([1000, 16])).not.toThrow();
  });

  it('is a no-op when there is no object2D at all', () => {
    const character = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, null, mockCharacterController2d());
    character.onSpawned({} as any);
    const controller = new CharacterAnimation2dController(character);
    controller.onSpawned({} as any);

    expect(() => controller.tick$.next([1000, 16])).not.toThrow();
  });

  describe('flipSpriteToFacing', () => {
    it('flips scale.x to match character.facing by default', () => {
      const object2D = mockAnimatedObject2d(clips);
      object2D.scale = { x: 2, y: 3 };
      const character = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, object2D, mockCharacterController2d());
      character.onSpawned({} as any);
      const controller = new CharacterAnimation2dController(character);
      controller.onSpawned({} as any);

      // `facing` only updates as a side effect of the character's own tick (moveDirection alone
      // doesn't retroactively update it) - fire the character's tick first, same as a real world's
      // tick order (character ticks pre-physics, this controller ticks at ANIMATION_MIXERS, after).
      character.moveDirection = -1;
      character.tick$.next([1000, 16]);
      controller.tick$.next([1000, 16]);
      expect(object2D.scale).toEqual({ x: -2, y: 3 });

      character.moveDirection = 1;
      character.tick$.next([1016, 16]);
      controller.tick$.next([1016, 16]);
      expect(object2D.scale).toEqual({ x: 2, y: 3 });
    });

    it('never flips when flipSpriteToFacing is false', () => {
      const object2D = mockAnimatedObject2d(clips);
      object2D.scale = { x: 2, y: 3 };
      const character = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, object2D, mockCharacterController2d());
      character.onSpawned({} as any);
      const controller = new CharacterAnimation2dController(character, { flipSpriteToFacing: false });
      controller.onSpawned({} as any);

      character.moveDirection = -1;
      character.tick$.next([1000, 16]);
      controller.tick$.next([1000, 16]);
      expect(object2D.scale).toEqual({ x: 2, y: 3 });
    });
  });

  describe('grounded debounce', () => {
    it("adopts the very first tick's isGrounded reading immediately, with no delay", () => {
      const object2D = mockAnimatedObject2d(clips);
      const cc = mockCharacterController2d(0.4, 1, {}, false); // starts airborne
      const character = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, object2D, cc);
      character.onSpawned({} as any);
      const controller = new CharacterAnimation2dController(character);
      controller.onSpawned({} as any);

      controller.tick$.next([1000, 16]); // a single 16ms tick - well under the 0.15s default delay

      expect(object2D.currentAnimationName).toBe('jump');
    });

    it('does not flicker to "jump" on a single-tick isGrounded blip (e.g. standing at an edge)', () => {
      const object2D = mockAnimatedObject2d(clips);
      const cc = mockCharacterController2d();
      const character = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, object2D, cc);
      character.onSpawned({} as any);
      const controller = new CharacterAnimation2dController(character);
      controller.onSpawned({} as any);

      controller.tick$.next([1000, 16]); // establishes "idle" (isGrounded true)
      expect(object2D.currentAnimationName).toBe('idle');

      (cc as any).isGrounded = false;
      controller.tick$.next([1016, 16]);
      (cc as any).isGrounded = true;
      controller.tick$.next([1032, 16]);

      expect(object2D.currentAnimationName).toBe('idle');
      expect(object2D.playCalls.map(c => c.name)).toEqual(['idle']);
    });

    it('commits to "jump" once isGrounded stays false for longer than groundedTransitionDelay', () => {
      const object2D = mockAnimatedObject2d(clips);
      const cc = mockCharacterController2d();
      const character = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, object2D, cc);
      character.onSpawned({} as any);
      const controller = new CharacterAnimation2dController(character, { groundedTransitionDelay: 0.15 });
      controller.onSpawned({} as any);

      controller.tick$.next([1000, 16]); // establishes "idle"
      (cc as any).isGrounded = false;

      let t = 1016;
      for (let i = 0; i < 9; i++) {
        controller.tick$.next([t, 16]);
        t += 16;
      }
      expect(object2D.currentAnimationName).toBe('idle');

      controller.tick$.next([t, 16]);
      expect(object2D.currentAnimationName).toBe('jump');
    });
  });
});
