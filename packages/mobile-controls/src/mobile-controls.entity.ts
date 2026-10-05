import { takeUntil } from 'rxjs';
import {
  CarHandlingController,
  FreeCameraController,
  GgCarHandlingController,
  GgWorld,
  IEntity,
  PlayerCharacterController,
  PlayerCharacterController2d,
  TickOrder,
} from '@gg-web-engine/core';
import { TouchControl } from './controls/touch-control';
import { carLayout, CarLayoutOptions } from './layouts/car.layout';
import { character2dLayout, Character2dLayoutOptions } from './layouts/character-2d.layout';
import { characterLayout, CharacterLayoutOptions } from './layouts/character.layout';
import { freeCameraLayout, FreeCameraLayoutOptions } from './layouts/free-camera.layout';
import { MobileControlsLayoutFactory, MobileControlsLayoutItem } from './mobile-controls-layout';
import { injectMobileControlsStyles } from './styles';

/**
 * Whether the device is operated by touch first (a phone, a tablet) - what `enabled: 'auto'` goes by.
 * A laptop that merely has a touch screen next to its mouse does not count.
 */
export function isTouchFirstDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(pointer: coarse)').matches;
  }
  return navigator.maxTouchPoints > 0;
}

export type MobileControlsOptions = {
  /**
   * `'auto'` (default): the overlay exists only on a touch-first device (`isTouchFirstDevice`).
   * `true`: always, e.g. to try the controls with a mouse. `false`: never.
   */
  enabled: boolean | 'auto';
  /**
   * The element the overlay is added to. `null` (default) puts it on `document.body`, covering the
   * viewport - right for a game filling the page. For a canvas that takes a part of the page, or one
   * that enters fullscreen through the Fullscreen API, pass an element wrapping the canvas (it has to
   * be positioned, e.g. `position: relative`): the overlay then covers exactly that element.
   */
  container: HTMLElement | null;
  /** Extra CSS class names for the overlay element, e.g. one overriding its `--gg-mc-*` properties. */
  className: string;
  /** Whether to add the default stylesheet to the page. `true` by default. */
  injectStyles: boolean;
  /**
   * Options of the built-in layout for `GgCarHandlingController` and a bare
   * `CarHandlingController`, or `false` to have none.
   */
  car: CarLayoutOptions | false;
  /** Options of the built-in layout for `PlayerCharacterController`, or `false` to have none. */
  character: CharacterLayoutOptions | false;
  /** Options of the built-in layout for `PlayerCharacterController2d`, or `false` to have none. */
  character2d: Character2dLayoutOptions | false;
  /** Options of the built-in layout for `FreeCameraController`, or `false` to have none. */
  freeCamera: FreeCameraLayoutOptions | false;
};

const DEFAULT_OPTIONS: MobileControlsOptions = {
  enabled: 'auto',
  container: null,
  className: '',
  injectStyles: true,
  car: {},
  character: {},
  character2d: {},
  freeCamera: {},
};

type ControllerClass<T extends IEntity> = abstract new (...args: any[]) => T;

/**
 * An overlay of on-screen touch controls over the game canvas. Add it to a world once, and it shows
 * the controls matching whichever input controller is active in that world at the moment, swapping
 * them as controllers are activated, deactivated, spawned and removed:
 *
 * ```ts
 * world.addEntity(new MobileControls());
 * ```
 *
 * Out of the box it knows the car controllers (`GgCarHandlingController`,
 * `CarHandlingController`), `PlayerCharacterController`, `PlayerCharacterController2d` and
 * `FreeCameraController`. Each of those layouts is adjusted through
 * its options (see `MobileControlsOptions`), replaced by `registerLayout`, and any other controller
 * class - including an app's own - gets a layout the same way. Controls that belong to no controller
 * (pause, a menu button) are added with `addControls`.
 */
export class MobileControls extends IEntity {
  static readonly entityTypeName: string = 'MobileControls';
  public readonly tickOrder = TickOrder.INPUT_CONTROLLERS;

  public readonly options: MobileControlsOptions;

  /** The overlay element. Created up front, attached to the page only while the overlay is shown. */
  public readonly element: HTMLElement;

  private readonly registrations: {
    controllerClass: ControllerClass<any>;
    factory: MobileControlsLayoutFactory<any>;
  }[] = [];
  private readonly tracked: Set<IEntity> = new Set<IEntity>();
  private readonly layouts: Map<IEntity, MobileControlsLayoutItem[]> = new Map<IEntity, MobileControlsLayoutItem[]>();
  private readonly ownControls: Set<TouchControl> = new Set<TouchControl>();
  private _enabled: boolean | 'auto';
  private _visible: boolean = true;

  public get enabled(): boolean | 'auto' {
    return this._enabled;
  }

  /** See `MobileControlsOptions.enabled`. */
  public set enabled(value: boolean | 'auto') {
    this._enabled = value;
    this.sync();
  }

  public get visible(): boolean {
    return this._visible;
  }

  /**
   * Hides the overlay without disabling it, for the moments touch controls are in the way (a menu,
   * a cutscene). Everything held is released.
   */
  public set visible(value: boolean) {
    this._visible = value;
    this.sync();
  }

  /** Whether the overlay is on the page right now. */
  public get shown(): boolean {
    return this.element.isConnected;
  }

  /** The controllers that currently have their controls on screen. */
  public get activeControllers(): IEntity[] {
    return [...this.layouts.keys()];
  }

  constructor(options: Partial<MobileControlsOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this._enabled = this.options.enabled;
    this.element = document.createElement('div');
    this.element.className = 'gg-mc';
    if (this.options.container) {
      this.element.classList.add('gg-mc--contained');
    }
    if (this.options.className) {
      this.element.classList.add(...this.options.className.split(/\s+/).filter(x => !!x));
    }
    this.releaseAll = this.releaseAll.bind(this);
    if (this.options.car) {
      const layout = carLayout(this.options.car);
      this.registerLayout(CarHandlingController, layout);
      this.registerLayout(GgCarHandlingController, layout);
    }
    if (this.options.character) {
      this.registerLayout(PlayerCharacterController, characterLayout(this.options.character));
    }
    if (this.options.character2d) {
      this.registerLayout(PlayerCharacterController2d, character2dLayout(this.options.character2d));
    }
    if (this.options.freeCamera) {
      this.registerLayout(FreeCameraController, freeCameraLayout(this.options.freeCamera));
    }
  }

  /**
   * Sets the layout shown while a controller of `controllerClass` (or of a subclass) is active,
   * replacing a layout registered for the same class before; `null` leaves that class without one.
   * Of several registered classes a controller is an instance of, the one registered last wins.
   */
  public registerLayout<T extends IEntity>(
    controllerClass: ControllerClass<T>,
    factory: MobileControlsLayoutFactory<T> | null,
  ): void {
    const index = this.registrations.findIndex(r => r.controllerClass === controllerClass);
    if (index >= 0) {
      this.registrations.splice(index, 1);
    }
    if (factory) {
      this.registrations.push({ controllerClass, factory });
    }
    if (this.world) {
      this.rescan();
    }
  }

  /**
   * Adds controls that stay on screen whichever controller is active, on top of the layouts.
   */
  public addControls(...controls: TouchControl[]): void {
    for (const control of controls) {
      this.ownControls.add(control);
      this.element.appendChild(control.element);
    }
  }

  /** Removes controls added by `addControls` and disposes them. */
  public removeControls(...controls: TouchControl[]): void {
    for (const control of controls) {
      if (this.ownControls.delete(control)) {
        control.dispose();
      }
    }
  }

  /**
   * Builds the layout of `controller` anew - after something its layout was built from has changed
   * (the car it drives, an option), since a layout is otherwise built once per activation.
   */
  public refresh(controller?: IEntity): void {
    for (const key of controller ? [controller] : [...this.layouts.keys()]) {
      this.disposeLayout(key);
    }
    this.sync();
  }

  onSpawned(world: GgWorld<any, any>): void {
    super.onSpawned(world);
    world.entityAdded$.pipe(takeUntil(this._onRemoved$)).subscribe(entity => {
      if (this.findFactory(entity)) {
        this.tracked.add(entity);
        this.sync();
      }
    });
    world.entityRemoved$.pipe(takeUntil(this._onRemoved$)).subscribe(entity => {
      if (this.tracked.delete(entity)) {
        this.sync();
      }
    });
    // a world whose input is switched off (a screen covering the game) takes its controls off the
    // screen; it may be paused at that moment, so this can't wait for the next tick
    world.inputEnabled$.pipe(takeUntil(this._onRemoved$)).subscribe(() => this.sync());
    // `active` has no change notification, so it is polled
    this.tick$.pipe(takeUntil(this._onRemoved$)).subscribe(() => this.sync());
    window.addEventListener('blur', this.releaseAll);
    this.rescan();
  }

  onRemoved(): void {
    super.onRemoved();
    window.removeEventListener('blur', this.releaseAll);
    this.tracked.clear();
    this.sync();
  }

  dispose(): void {
    super.dispose();
    for (const control of this.ownControls) {
      control.dispose();
    }
    this.ownControls.clear();
  }

  /** Returns every control on screen to its untouched state. */
  public releaseAll(): void {
    for (const items of this.layouts.values()) {
      for (const item of items) {
        if (item instanceof TouchControl) {
          item.reset();
        }
      }
    }
    for (const control of this.ownControls) {
      control.reset();
    }
  }

  private findFactory(entity: IEntity): MobileControlsLayoutFactory<any> | null {
    for (let i = this.registrations.length - 1; i >= 0; i--) {
      if (entity instanceof this.registrations[i].controllerClass) {
        return this.registrations[i].factory;
      }
    }
    return null;
  }

  private rescan(): void {
    this.tracked.clear();
    const visit = (entity: IEntity) => {
      if (this.findFactory(entity)) {
        this.tracked.add(entity);
      }
      entity.children.forEach(visit);
    };
    (this.world?.children || []).forEach(visit);
    for (const controller of [...this.layouts.keys()]) {
      this.disposeLayout(controller);
    }
    this.sync();
  }

  private sync(): void {
    const world = this.world;
    const show =
      !!world &&
      this._visible &&
      world.inputEnabled !== false &&
      (this._enabled === 'auto' ? isTouchFirstDevice() : this._enabled);
    if (show !== this.shown) {
      if (show) {
        if (this.options.injectStyles) {
          injectMobileControlsStyles();
        }
        (this.options.container || document.body).appendChild(this.element);
      } else {
        this.releaseAll();
        this.element.remove();
      }
    }
    for (const controller of [...this.layouts.keys()]) {
      if (!show || !this.tracked.has(controller) || !controller.active) {
        this.disposeLayout(controller);
      }
    }
    if (!show) {
      return;
    }
    for (const controller of this.tracked) {
      if (controller.active && !this.layouts.has(controller)) {
        const items = this.findFactory(controller)!(controller, { world: world!, controls: this });
        this.layouts.set(controller, items);
        // below the controls added by `addControls`, which stay on top
        const before = this.ownControls.size > 0 ? [...this.ownControls][0].element : null;
        for (const item of items) {
          if (item instanceof TouchControl) {
            this.element.insertBefore(item.element, before);
          }
        }
      }
    }
  }

  private disposeLayout(controller: IEntity): void {
    const items = this.layouts.get(controller);
    if (items) {
      this.layouts.delete(controller);
      for (const item of items) {
        item.dispose();
      }
    }
  }
}
