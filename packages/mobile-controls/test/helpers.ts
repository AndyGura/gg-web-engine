import { GgWorld } from '@gg-web-engine/core';

export class TestWorld extends GgWorld<any, any> {
  constructor() {
    super({
      visualScene: { init: async () => {}, dispose: () => {} } as any,
      physicsWorld: { init: async () => {}, simulate: () => {}, dispose: () => {} } as any,
    });
  }

  addPrimitiveRigidBody(): any {
    return undefined;
  }
}

export const tick = (world: GgWorld<any, any>, elapsed: number = 0, delta: number = 16) =>
  (world.worldClock as any)._tick$.next([elapsed, delta]);

/** Dispatches a touch pointer event; built on MouseEvent so it does not depend on jsdom's PointerEvent. */
export const pointer = (
  target: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  x: number = 0,
  y: number = 0,
  pointerId: number = 1,
) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  target.dispatchEvent(event);
  return event;
};

/** Gives an element a layout box, which jsdom never computes. */
export const setRect = (element: Element, left: number, top: number, width: number, height: number) => {
  element.getBoundingClientRect = () =>
    ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
};
