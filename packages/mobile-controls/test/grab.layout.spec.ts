import { KeyboardInput, MouseInput, ObjectGrabController } from '@gg-web-engine/core';
import { MobileControls } from '../src';
import { pointer, TestWorld } from './helpers';

describe('grab layout', () => {
  let world: TestWorld;
  let controller: ObjectGrabController;

  beforeEach(async () => {
    world = new TestWorld();
    await world.init();
    const mouse = new MouseInput();
    controller = new ObjectGrabController(world.keyboardInput, mouse, {} as any, null, { grabKey: 'KeyF' });
  });

  afterEach(() => {
    world.dispose();
    document.body.innerHTML = '';
  });

  const ids = (controls: MobileControls) =>
    [...controls.element.querySelectorAll('[data-gg-mc]')].map(e => (e as HTMLElement).dataset.ggMc);
  const control = (controls: MobileControls, id: string) =>
    controls.element.querySelector(`.gg-mc-id-${id}`)! as HTMLElement;

  it('shows a grab button, and a throw button only while something is held', () => {
    world.addEntity(controller);
    const controls = new MobileControls({ enabled: true });
    world.addEntity(controls);
    expect(ids(controls)).toEqual(['grab', 'throw']);
    expect(control(controls, 'grab').getAttribute('aria-label')).toBe('Grab');
    expect(control(controls, 'throw').hidden).toBe(true);

    const held = { release() {} } as any;
    (controller as any)._heldObject$.next(held);
    expect(control(controls, 'grab').getAttribute('aria-label')).toBe('Release');
    expect(control(controls, 'grab').classList.contains('gg-mc-holding')).toBe(true);
    expect(control(controls, 'throw').hidden).toBe(false);

    (controller as any)._heldObject$.next(null);
    expect(control(controls, 'grab').getAttribute('aria-label')).toBe('Grab');
    expect(control(controls, 'throw').hidden).toBe(true);
  });

  it("presses the controller's grab key and throws through the controller", () => {
    world.addEntity(controller);
    const controls = new MobileControls({ enabled: true });
    world.addEntity(controls);
    const down = jest.spyOn(world.keyboardInput, 'emulateKeyDown');
    const up = jest.spyOn(world.keyboardInput, 'emulateKeyUp');
    const throwHeld = jest.spyOn(controller, 'throwHeld').mockImplementation(() => {});

    const grab = control(controls, 'grab');
    pointer(grab, 'pointerdown', 5, 5);
    expect(down).toHaveBeenCalledWith('KeyF');
    pointer(grab, 'pointerup', 5, 5);
    expect(up).toHaveBeenCalledWith('KeyF');

    (controller as any)._heldObject$.next({ release() {} } as any);
    pointer(control(controls, 'throw'), 'pointerdown', 5, 5);
    expect(throwHeld).toHaveBeenCalledTimes(1);
  });

  it('can be left out or trimmed to the grab button', () => {
    world.addEntity(controller);
    const none = new MobileControls({ enabled: true, grab: false });
    world.addEntity(none);
    expect(ids(none)).toEqual([]);
    world.removeEntity(none, true);

    const grabOnly = new MobileControls({ enabled: true, grab: { throw: false } });
    world.addEntity(grabOnly);
    expect(ids(grabOnly)).toEqual(['grab']);
  });
});
