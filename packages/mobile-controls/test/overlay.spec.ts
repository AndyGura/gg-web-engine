import { BehaviorSubject, Subject } from 'rxjs';
import { GgCarHandlingController } from '@gg-web-engine/core';
import { MobileControls, MobileControlsIcons, TouchButton } from '../src';
import { pointer, TestWorld } from './helpers';

describe('MobileControls overlay options', () => {
  let world: TestWorld;

  beforeEach(async () => {
    world = new TestWorld();
    await world.init();
  });

  afterEach(() => {
    world.dispose();
    document.body.innerHTML = '';
  });

  const control = (controls: MobileControls, id: string) =>
    controls.element.querySelector(`.gg-mc-id-${id}`)! as HTMLElement;
  /** The markup as the DOM serializes it back */
  const icon = (markup: string) => {
    const element = document.createElement('div');
    element.innerHTML = markup;
    return element.innerHTML;
  };

  describe('inset', () => {
    it('is written to the overlay as custom properties in placement units, per edge', () => {
      const controls = new MobileControls({ enabled: true, inset: { left: -2, right: -2 } });
      expect(controls.element.style.getPropertyValue('--gg-mc-inset-left')).toBe('-2');
      expect(controls.element.style.getPropertyValue('--gg-mc-inset-right')).toBe('-2');
      expect(controls.element.style.getPropertyValue('--gg-mc-inset-top')).toBe('');

      controls.inset = 1.5;
      for (const edge of ['left', 'right', 'top', 'bottom']) {
        expect(controls.element.style.getPropertyValue(`--gg-mc-inset-${edge}`)).toBe('1.5');
      }
      controls.inset = 0;
      expect(controls.element.style.getPropertyValue('--gg-mc-inset-left')).toBe('');
    });

    it('moves every control placed by numbers, layouts and own controls alike, and leaves CSS strings alone', () => {
      world.addEntity(new GgCarHandlingController(world.keyboardInput, null));
      const controls = new MobileControls({
        enabled: true,
        inset: { left: -2 },
        car: { placements: { brake: { right: '10%' } } },
      });
      const own = new TouchButton({ id: 'menu', placement: { left: 4, top: 4 } });
      controls.addControls(own);
      world.addEntity(controls);

      expect(control(controls, 'steer-left').style.left).toContain('(4 + var(--gg-mc-inset-left, 0))');
      expect(control(controls, 'accelerate').style.right).toContain('(4 + var(--gg-mc-inset-right, 0))');
      expect(control(controls, 'accelerate').style.bottom).toContain('var(--gg-mc-inset-bottom, 0)');
      expect(own.element.style.left).toContain('var(--gg-mc-inset-left, 0)');
      expect(own.element.style.top).toContain('var(--gg-mc-inset-top, 0)');
      expect(control(controls, 'brake').style.right).toBe('10%');
    });
  });

  describe('visible$', () => {
    it('hides the overlay until it emits true, and follows it', () => {
      const visible$ = new Subject<boolean>();
      const controls = new MobileControls({ enabled: true, visible$ });
      world.addEntity(controls);
      expect(controls.shown).toBe(false);

      visible$.next(true);
      expect(controls.shown).toBe(true);
      visible$.next(false);
      expect(controls.shown).toBe(false);
    });

    it('releases every held key and direction when it turns false', () => {
      const car = new GgCarHandlingController(world.keyboardInput, null);
      world.addEntity(car);
      const visible$ = new BehaviorSubject<boolean>(true);
      const controls = new MobileControls({ enabled: true, visible$ });
      world.addEntity(controls);
      const handbrake: boolean[] = [];
      world.keyboardInput.bind(car.options.handbrakeKey).subscribe(v => handbrake.push(v));

      pointer(control(controls, 'handbrake'), 'pointerdown', 0, 0, 1);
      pointer(control(controls, 'accelerate'), 'pointerdown', 0, 0, 2);
      expect(car.carHandlingInput.directionsInput.direction.y).toBe(1);

      visible$.next(false);
      expect(handbrake).toEqual([false, true, false]);
      expect(car.carHandlingInput.directionsInput.direction.y).toBe(0);
    });

    it('stops following it once disposed', () => {
      const visible$ = new Subject<boolean>();
      const controls = new MobileControls({ enabled: true, visible$ });
      world.addEntity(controls);
      world.removeEntity(controls, true);
      expect(visible$.observed).toBe(false);
    });
  });

  describe('pause button', () => {
    it('is not there by default', () => {
      const controls = new MobileControls({ enabled: true });
      expect(controls.pauseButton).toBeNull();
      expect(controls.fullscreenButton).toBeNull();
    });

    it('pauses and resumes the world, showing what the next press does, on top of every layout', () => {
      world.addEntity(new GgCarHandlingController(world.keyboardInput, null));
      const controls = new MobileControls({ enabled: true, pauseButton: true });
      world.addEntity(controls);
      world.start();
      const button = controls.pauseButton!;
      expect(controls.element.lastElementChild).toBe(button.element);
      expect(button.element.innerHTML).toBe(icon(MobileControlsIcons.pause));

      pointer(button.element, 'pointerdown');
      pointer(button.element, 'pointerup');
      expect(world.isPaused).toBe(true);
      expect(button.element.innerHTML).toBe(icon(MobileControlsIcons.resume));
      // a paused world keeps its overlay (its input is still on), so the same button resumes it
      expect(controls.shown).toBe(true);

      pointer(button.element, 'pointerdown');
      expect(world.isPaused).toBe(false);
      expect(button.element.innerHTML).toBe(icon(MobileControlsIcons.pause));
    });

    it('does not pause a world that may not be paused locally, and takes its own action instead', () => {
      const controls = new MobileControls({ enabled: true, pauseButton: { icon: 'II', placement: { right: 4 } } });
      world.addEntity(controls);
      world.start();
      world.localPauseAllowed = false;
      pointer(controls.pauseButton!.element, 'pointerdown');
      expect(world.isPaused).toBe(false);
      expect(controls.pauseButton!.element.textContent).toBe('II');
      expect(controls.pauseButton!.element.style.left).toBe('');
      expect(controls.pauseButton!.element.style.right).toContain('4');

      const onPress = jest.fn();
      const menu = new MobileControls({ enabled: true, pauseButton: { onPress } });
      world.addEntity(menu);
      world.localPauseAllowed = true;
      pointer(menu.pauseButton!.element, 'pointerdown');
      expect(onPress).toHaveBeenCalledWith(menu);
      expect(world.isPaused).toBe(false);
    });
  });

  describe('fullscreen button', () => {
    const stubbed: [any, string][] = [];
    const stub = (target: any, key: string, value: any) => {
      stubbed.push([target, key]);
      Object.defineProperty(target, key, { configurable: true, writable: true, value });
    };

    afterEach(() => {
      for (const [target, key] of stubbed.splice(0)) {
        delete target[key];
      }
    });

    it('is hidden where fullscreen is not available', () => {
      const controls = new MobileControls({ enabled: true, fullscreenButton: true });
      world.addEntity(controls);
      expect(controls.fullscreenButton!.visible).toBe(false);
    });

    it('toggles fullscreen of the container on the finger lifting, and shows the state', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      let current: Element | null = null;
      stub(document, 'fullscreenEnabled', true);
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => current });
      stubbed.push([document, 'fullscreenElement']);
      const request = jest.fn(async function (this: Element) {
        current = this;
        document.dispatchEvent(new Event('fullscreenchange'));
      });
      stub(container, 'requestFullscreen', request);
      stub(document, 'exitFullscreen', async () => {
        current = null;
        document.dispatchEvent(new Event('fullscreenchange'));
      });

      const controls = new MobileControls({ enabled: true, container, fullscreenButton: true });
      world.addEntity(controls);
      const button = controls.fullscreenButton!;
      expect(button.visible).toBe(true);
      expect(button.element.innerHTML).toBe(icon(MobileControlsIcons.fullscreen));

      // not on the finger going down: a touch grants the user gesture on lifting
      pointer(button.element, 'pointerdown');
      expect(request).not.toHaveBeenCalled();
      pointer(button.element, 'pointerup');
      expect(request).toHaveBeenCalledTimes(1);
      await Promise.resolve();
      expect(current).toBe(container);
      expect(button.element.innerHTML).toBe(icon(MobileControlsIcons.exitFullscreen));

      pointer(button.element, 'pointerdown');
      pointer(button.element, 'pointerup');
      await Promise.resolve();
      expect(current).toBeNull();
      expect(button.element.innerHTML).toBe(icon(MobileControlsIcons.fullscreen));
    });
  });
});
