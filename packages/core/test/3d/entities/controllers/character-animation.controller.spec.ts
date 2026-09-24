import { CharacterAnimationController, CharacterController3dEntity } from '../../../../src';
import { mockCharacterController } from '../../../mocks/character-controller.mock';
import { mock3DObject, mockAnimatedObject } from '../../../mocks/object.mock';

const clips = ['idle', 'walk', 'run', 'crouch', 'jump'];

describe('CharacterAnimationController', () => {
  it('plays "idle" by default when grounded and not moving', () => {
    const object3D = mockAnimatedObject(clips);
    const character = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, object3D, mockCharacterController());
    character.onSpawned({} as any);
    const controller = new CharacterAnimationController(character);
    controller.onSpawned({} as any);

    controller.tick$.next([1000, 16]);

    expect(object3D.currentAnimationName).toBe('idle');
  });

  it('switches to "walk"/"run" based on moveDirection and isRunning', () => {
    const object3D = mockAnimatedObject(clips);
    const character = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, object3D, mockCharacterController());
    character.onSpawned({} as any);
    const controller = new CharacterAnimationController(character);
    controller.onSpawned({} as any);

    character.moveDirection = { x: 0, y: 1, z: 0 };
    controller.tick$.next([1000, 16]);
    expect(object3D.currentAnimationName).toBe('walk');

    character.isRunning = true;
    controller.tick$.next([1016, 16]);
    expect(object3D.currentAnimationName).toBe('run');
  });

  it('switches to "crouch" while crouching, regardless of movement', () => {
    const object3D = mockAnimatedObject(clips);
    const cc = mockCharacterController();
    const character = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, object3D, cc);
    character.onSpawned({} as any);
    const controller = new CharacterAnimationController(character);
    controller.onSpawned({} as any);

    character.isCrouching = true;
    controller.tick$.next([1000, 16]);

    expect(object3D.currentAnimationName).toBe('crouch');
  });

  it('switches to "jump" whenever the character is airborne, taking priority over crouch', () => {
    const object3D = mockAnimatedObject(clips);
    const cc = mockCharacterController(0.4, 1, {}, false);
    const character = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, object3D, cc);
    character.onSpawned({} as any);
    const controller = new CharacterAnimationController(character);
    controller.onSpawned({} as any);

    controller.tick$.next([1000, 16]);

    expect(object3D.currentAnimationName).toBe('jump');
  });

  it('only calls playAnimation when the resolved state actually changes', () => {
    const object3D = mockAnimatedObject(clips);
    const character = new CharacterController3dEntity(
      { radius: 0.4, centersDistance: 1 },
      object3D,
      mockCharacterController(),
    );
    character.onSpawned({} as any);
    const controller = new CharacterAnimationController(character);
    controller.onSpawned({} as any);

    controller.tick$.next([1000, 16]);
    controller.tick$.next([1016, 16]);
    controller.tick$.next([1032, 16]);

    expect(object3D.playCalls.length).toBe(1);
    expect(object3D.playCalls[0].name).toBe('idle');
  });

  it('respects a custom clipMap override', () => {
    const object3D = mockAnimatedObject(['Idle_Loop']);
    const character = new CharacterController3dEntity(
      { radius: 0.4, centersDistance: 1 },
      object3D,
      mockCharacterController(),
    );
    character.onSpawned({} as any);
    const controller = new CharacterAnimationController(character, { clipMap: { idle: 'Idle_Loop' } });
    controller.onSpawned({} as any);

    controller.tick$.next([1000, 16]);

    expect(object3D.currentAnimationName).toBe('Idle_Loop');
  });

  it('does not switch state when the resolved clip name is missing from the model', () => {
    const object3D = mockAnimatedObject(['walk']); // no "idle" clip
    const character = new CharacterController3dEntity(
      { radius: 0.4, centersDistance: 1 },
      object3D,
      mockCharacterController(),
    );
    character.onSpawned({} as any);
    const controller = new CharacterAnimationController(character);
    controller.onSpawned({} as any);

    controller.tick$.next([1000, 16]);

    expect(object3D.currentAnimationName).toBeNull();
    expect(object3D.playCalls.length).toBe(0);
  });

  it('is a no-op (does not throw) when object3D is not an animated display object', () => {
    const object3D = mock3DObject();
    const character = new CharacterController3dEntity(
      { radius: 0.4, centersDistance: 1 },
      object3D,
      mockCharacterController(),
    );
    character.onSpawned({} as any);
    const controller = new CharacterAnimationController(character);
    controller.onSpawned({} as any);

    expect(() => controller.tick$.next([1000, 16])).not.toThrow();
  });

  it('is a no-op when there is no object3D at all', () => {
    const character = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, null, mockCharacterController());
    character.onSpawned({} as any);
    const controller = new CharacterAnimationController(character);
    controller.onSpawned({} as any);

    expect(() => controller.tick$.next([1000, 16])).not.toThrow();
  });

  describe('grounded debounce', () => {
    it('adopts the very first tick\'s isGrounded reading immediately, with no delay', () => {
      const object3D = mockAnimatedObject(clips);
      const cc = mockCharacterController(0.4, 1, {}, false); // starts airborne
      const character = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, object3D, cc);
      character.onSpawned({} as any);
      const controller = new CharacterAnimationController(character);
      controller.onSpawned({} as any);

      controller.tick$.next([1000, 16]); // a single 16ms tick - well under the 0.15s default delay

      expect(object3D.currentAnimationName).toBe('jump');
    });

    it('does not flicker to "jump" on a single-tick isGrounded blip (e.g. standing at an edge)', () => {
      const object3D = mockAnimatedObject(clips);
      const cc = mockCharacterController();
      const character = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, object3D, cc);
      character.onSpawned({} as any);
      const controller = new CharacterAnimationController(character);
      controller.onSpawned({} as any);

      controller.tick$.next([1000, 16]); // establishes "idle" (isGrounded true)
      expect(object3D.currentAnimationName).toBe('idle');

      // A single tick's worth of noise (well under the 0.15s default delay), then back to grounded -
      // simulates a raw sweep result flipping momentarily at a ledge with no real movement.
      (cc as any).isGrounded = false;
      controller.tick$.next([1016, 16]);
      (cc as any).isGrounded = true;
      controller.tick$.next([1032, 16]);

      expect(object3D.currentAnimationName).toBe('idle');
      expect(object3D.playCalls.map(c => c.name)).toEqual(['idle']);
    });

    it('does not commit even under sustained rapid alternation, as long as no single value holds past the delay', () => {
      const object3D = mockAnimatedObject(clips);
      const cc = mockCharacterController();
      const character = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, object3D, cc);
      character.onSpawned({} as any);
      const controller = new CharacterAnimationController(character, { groundedTransitionDelay: 0.15 });
      controller.onSpawned({} as any);

      controller.tick$.next([1000, 16]); // establishes "idle"

      // Flip every tick for 200ms (well past the 0.15s delay in total), but each individual streak
      // is only ever one 16ms tick long - never enough to actually commit a change.
      let t = 1016;
      for (let i = 0; i < 12; i++) {
        (cc as any).isGrounded = i % 2 === 0 ? false : true;
        controller.tick$.next([t, 16]);
        t += 16;
      }

      expect(object3D.currentAnimationName).toBe('idle');
    });

    it('commits to "jump" once isGrounded stays false for longer than groundedTransitionDelay', () => {
      const object3D = mockAnimatedObject(clips);
      const cc = mockCharacterController();
      const character = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, object3D, cc);
      character.onSpawned({} as any);
      const controller = new CharacterAnimationController(character, { groundedTransitionDelay: 0.15 });
      controller.onSpawned({} as any);

      controller.tick$.next([1000, 16]); // establishes "idle"
      (cc as any).isGrounded = false;

      // 9 * 16ms = 144ms - just under the 150ms delay, should still read "idle".
      let t = 1016;
      for (let i = 0; i < 9; i++) {
        controller.tick$.next([t, 16]);
        t += 16;
      }
      expect(object3D.currentAnimationName).toBe('idle');

      // One more tick crosses the 150ms threshold.
      controller.tick$.next([t, 16]);
      expect(object3D.currentAnimationName).toBe('jump');
    });

    it('groundedTransitionDelay: 0 disables debouncing (every raw flip is trusted immediately)', () => {
      const object3D = mockAnimatedObject(clips);
      const cc = mockCharacterController();
      const character = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, object3D, cc);
      character.onSpawned({} as any);
      const controller = new CharacterAnimationController(character, { groundedTransitionDelay: 0 });
      controller.onSpawned({} as any);

      controller.tick$.next([1000, 16]); // establishes "idle"
      (cc as any).isGrounded = false;
      controller.tick$.next([1016, 16]);

      expect(object3D.currentAnimationName).toBe('jump');
    });
  });
});
