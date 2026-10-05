import { Pnt2 } from '@gg-web-engine/core';
import { TouchControlOptions } from './touch-control';
import { TouchAxisControl } from './touch-axis-control';

export type TouchStickOptions = TouchControlOptions & {
  /**
   * `'fixed'` (default): the stick stays where it is placed. `'floating'`: the control is a touch
   * zone (give it a `placement` with a size), and the stick appears under the finger wherever the
   * zone is touched, so the thumb never has to find it.
   */
  mode?: 'fixed' | 'floating';
  /** Which axes the stick moves along. `'both'` by default. */
  axes?: 'both' | 'x' | 'y';
  /** The fraction of the travel around the center that reads as zero. 0.12 by default. */
  deadzone?: number;
  /**
   * How far the knob travels from the center at full deflection, in pixels. By default 36% of the
   * rendered width of the base.
   */
  travel?: number;
};

/**
 * An on-screen analog stick.
 */
export class TouchStick extends TouchAxisControl {
  public readonly mode: 'fixed' | 'floating';
  public readonly axes: 'both' | 'x' | 'y';
  public readonly deadzone: number;

  private readonly base: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly travelOption: number | undefined;
  private center = Pnt2.O;
  private travel: number = 1;

  constructor(options: TouchStickOptions = {}) {
    super('stick', options);
    this.mode = options.mode || 'fixed';
    this.axes = options.axes || 'both';
    this.deadzone = options.deadzone ?? 0.12;
    this.travelOption = options.travel;
    this.element.classList.add(`gg-mc-stick--${this.mode}`);
    this.base = document.createElement('div');
    this.base.className = 'gg-mc-stick-base';
    this.knob = document.createElement('div');
    this.knob.className = 'gg-mc-stick-knob';
    this.base.appendChild(this.knob);
    this.element.appendChild(this.base);
  }

  protected onPointerStart(event: PointerEvent): void {
    this.element.classList.add('gg-mc-active');
    if (this.mode === 'floating') {
      const zone = this.element.getBoundingClientRect();
      this.base.style.left = `${event.clientX - zone.left}px`;
      this.base.style.top = `${event.clientY - zone.top}px`;
      this.center = { x: event.clientX, y: event.clientY };
    }
    const rect = this.base.getBoundingClientRect();
    if (this.mode === 'fixed') {
      this.center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    this.travel = this.travelOption ?? (rect.width * 0.36 || 50);
    this.update(event);
  }

  protected onPointerMove(event: PointerEvent): void {
    this.update(event);
  }

  protected onPointerEnd(): void {
    this.element.classList.remove('gg-mc-active');
    this.base.style.left = '';
    this.base.style.top = '';
    this.knob.style.transform = '';
    this.setValue(Pnt2.O);
  }

  private update(event: PointerEvent): void {
    let offset = { x: (event.clientX - this.center.x) / this.travel, y: (event.clientY - this.center.y) / this.travel };
    if (this.axes === 'x') {
      offset.y = 0;
    } else if (this.axes === 'y') {
      offset.x = 0;
    }
    const length = Pnt2.len(offset);
    if (length > 1) {
      offset = Pnt2.scalarMult(offset, 1 / length);
    }
    this.knob.style.transform = `translate(-50%, -50%) translate(${offset.x * this.travel}px, ${offset.y * this.travel}px)`;
    if (length <= this.deadzone) {
      this.setValue(Pnt2.O);
      return;
    }
    // rescaled so the value starts from 0 right outside the deadzone instead of jumping to it
    const scale = (Math.min(1, length) - this.deadzone) / (1 - this.deadzone) / Math.min(1, length);
    this.setValue({ x: offset.x * scale, y: offset.y === 0 ? 0 : -offset.y * scale });
  }
}
