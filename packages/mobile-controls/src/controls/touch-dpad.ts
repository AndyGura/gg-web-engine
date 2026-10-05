import { Pnt2 } from '@gg-web-engine/core';
import { TouchControlOptions } from './touch-control';
import { TouchAxisControl } from './touch-axis-control';
import { MobileControlsIcons } from '../icons';

export type TouchDPadOptions = TouchControlOptions & {
  /** Whether two neighboring directions can be held at once. `true` by default. */
  diagonals?: boolean;
  /** What each arm shows: markup or a DOM node. Arrows by default. */
  content?: { up?: string | Node; down?: string | Node; left?: string | Node; right?: string | Node };
};

const ARMS = ['up', 'down', 'left', 'right'] as const;

/**
 * An on-screen directional pad: four arms read as one control, so a thumb slides from one direction
 * to another without lifting. Each axis of its value is -1, 0 or 1.
 */
export class TouchDPad extends TouchAxisControl {
  public readonly diagonals: boolean;

  private readonly arms: { [arm in (typeof ARMS)[number]]: HTMLElement };

  constructor(options: TouchDPadOptions = {}) {
    super('dpad', options);
    this.diagonals = options.diagonals ?? true;
    this.arms = {} as any;
    for (const arm of ARMS) {
      const element = document.createElement('div');
      element.className = `gg-mc-dpad-arm gg-mc-dpad-arm--${arm}`;
      const content = options.content?.[arm] ?? MobileControlsIcons[arm];
      if (typeof content === 'string') {
        element.innerHTML = content;
      } else {
        element.appendChild(content);
      }
      this.arms[arm] = element;
      this.element.appendChild(element);
    }
  }

  protected onPointerStart(event: PointerEvent): void {
    this.update(event);
  }

  protected onPointerMove(event: PointerEvent): void {
    this.update(event);
  }

  protected onPointerEnd(): void {
    this.apply(0, 0);
  }

  private update(event: PointerEvent): void {
    const rect = this.element.getBoundingClientRect();
    const radius = rect.width / 2 || 50;
    const offset = {
      x: (event.clientX - (rect.left + rect.width / 2)) / radius,
      y: (event.clientY - (rect.top + rect.height / 2)) / radius,
    };
    if (Pnt2.len(offset) < 0.18) {
      this.apply(0, 0);
      return;
    }
    // split the circle into 8 sectors (4 without diagonals) and take the one the pointer is in
    const sectors = this.diagonals ? 8 : 4;
    const angle = (Math.round(Math.atan2(-offset.y, offset.x) / ((Math.PI * 2) / sectors)) * Math.PI * 2) / sectors;
    this.apply(Math.round(Math.cos(angle)), Math.round(Math.sin(angle)));
  }

  private apply(x: number, y: number): void {
    this.arms.up.classList.toggle('gg-mc-active', y > 0);
    this.arms.down.classList.toggle('gg-mc-active', y < 0);
    this.arms.left.classList.toggle('gg-mc-active', x < 0);
    this.arms.right.classList.toggle('gg-mc-active', x > 0);
    this.setValue({ x: x === 0 ? 0 : x, y: y === 0 ? 0 : y });
  }
}
