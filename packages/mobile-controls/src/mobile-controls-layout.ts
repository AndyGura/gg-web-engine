import { GgWorld, IEntity } from '@gg-web-engine/core';
import { ControlPlacement, TouchControl } from './controls/touch-control';
import type { MobileControls } from './mobile-controls.entity';

export type MobileControlsLayoutContext = {
  world: GgWorld<any, any>;
  /** The overlay the layout is built for. */
  controls: MobileControls;
};

/**
 * One piece of a layout: a `TouchControl`, or anything else that lives as long as the layout does (a
 * `TiltInput` wired to the controller, a subscription) and is ended through `dispose`.
 */
export type MobileControlsLayoutItem = TouchControl | { dispose(): void };

/**
 * Builds the on-screen controls for one controller entity, already bound to it. Called every time
 * the controller becomes active; the returned items are disposed when it stops being active or
 * leaves the world. The controls are stacked in the returned order, the last one on top.
 */
export type MobileControlsLayoutFactory<T extends IEntity = IEntity> = (
  controller: T,
  context: MobileControlsLayoutContext,
) => MobileControlsLayoutItem[];

/**
 * What every built-in layout lets an app adjust without replacing the layout. `Id` are the ids of
 * the controls that layout can contain.
 */
export type LayoutCustomization<T extends IEntity, Id extends string> = {
  /** Moves/resizes a control. Merged over that control's default placement, edge by edge. */
  placements?: { [id in Id]?: ControlPlacement };
  /** Replaces what a button shows: markup (an inline SVG, plain text) or a DOM node. */
  icons?: { [id in Id]?: string | Node };
  /** Leaves controls out of the layout. */
  hide?: Id[];
  /** Adds controls of the app's own to the layout. */
  extra?: MobileControlsLayoutFactory<T>;
};

/**
 * Applies a `LayoutCustomization` while a built-in layout is put together.
 */
export class LayoutBuilder<T extends IEntity, Id extends string> {
  public readonly result: MobileControlsLayoutItem[] = [];

  constructor(private readonly customization: LayoutCustomization<T, Id>) {}

  /** Whether the control with this id is to be built at all. */
  has(id: Id): boolean {
    return !(this.customization.hide || []).includes(id);
  }

  placement(id: Id, defaults: ControlPlacement): ControlPlacement {
    const custom = this.customization.placements?.[id];
    if (!custom) {
      return defaults;
    }
    // an edge given by the app takes over from the opposite default one instead of stretching between
    const merged = { ...defaults, ...custom };
    if (custom.left !== undefined && custom.right === undefined) delete merged.right;
    if (custom.right !== undefined && custom.left === undefined) delete merged.left;
    if (custom.top !== undefined && custom.bottom === undefined) delete merged.bottom;
    if (custom.bottom !== undefined && custom.top === undefined) delete merged.top;
    return merged;
  }

  icon(id: Id, defaults: string): string | Node {
    return this.customization.icons?.[id] ?? defaults;
  }

  /** Adds the control `create` makes, unless the app hid it. */
  add(id: Id, create: () => TouchControl): void {
    if (this.has(id)) {
      this.result.push(create());
    }
  }

  finish(controller: T, context: MobileControlsLayoutContext): MobileControlsLayoutItem[] {
    if (this.customization.extra) {
      this.result.push(...this.customization.extra(controller, context));
    }
    return this.result;
  }
}
