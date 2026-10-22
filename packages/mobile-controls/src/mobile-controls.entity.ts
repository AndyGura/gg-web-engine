import { filter, Observable, takeUntil } from 'rxjs';
import {
  CarHandlingController,
  FreeCameraController,
  GgCarHandlingController,
  GgWorld,
  IEntity,
  isRebindableController,
  ObjectGrabController,
  PlayerCharacterController,
  PlayerCharacterController2d,
  TickOrder,
} from '@gg-web-engine/core';
import { ControlPlacement, TouchControl } from './controls/touch-control';
import { TouchButton } from './controls/touch-button';
import { fullscreen$, isFullscreenAvailable, toggleFullscreen } from './fullscreen';
import { MobileControlsIcons } from './icons';
import { carLayout, CarLayoutOptions } from './layouts/car.layout';
import { character2dLayout, Character2dLayoutOptions } from './layouts/character-2d.layout';
import { characterLayout, CharacterLayoutOptions } from './layouts/character.layout';
import { freeCameraLayout, FreeCameraLayoutOptions } from './layouts/free-camera.layout';
import { grabLayout, GrabLayoutOptions } from './layouts/grab.layout';
import { mergeControlPlacement, MobileControlsLayoutFactory, MobileControlsLayoutItem } from './mobile-controls-layout';
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

/**
 * How far the controls sit from the overlay's edges, on top of their placements, in multiples of
 * `--gg-mc-unit` (the unit placements are given in): one number for every edge, or per edge (an edge
 * left out stays at 0). Positive moves the controls inwards, negative towards the edges.
 */
export type MobileControlsInset = number | { left?: number; right?: number; top?: number; bottom?: number };

/** What the pause and fullscreen buttons of the overlay let an app adjust. */
export type OverlayButtonOptions = {
  /** Merged over the button's default placement, edge by edge (see `mergeControlPlacement`). */
  placement?: ControlPlacement;
  /** What the button shows: markup (an inline SVG, plain text) or a DOM node. */
  icon?: string | Node;
  /** Accessible name of the button. */
  label?: string;
};

export type PauseButtonOptions = OverlayButtonOptions & {
  /**
   * What the button shows while the world is paused, with the default action (no `onPress`).
   * `MobileControlsIcons.resume` by default.
   */
  resumeIcon?: string | Node;
  /**
   * What a press does, replacing the default: pausing the world (`pauseWorld()`, unless
   * `localPauseAllowed` is `false` - a shared multiplayer world), or resuming it when it is paused.
   * A game with a pause menu opens the menu here instead: a `ScreenManager` pausing the world under
   * the menu resumes it when the menu closes, which it would not do for a world this button paused.
   */
  onPress?: (controls: MobileControls) => void;
};

export type FullscreenButtonOptions = OverlayButtonOptions & {
  /** What the button shows while fullscreen. `MobileControlsIcons.exitFullscreen` by default. */
  exitIcon?: string | Node;
  /**
   * The element shown fullscreen: by default the overlay's `container`, or the whole page when it
   * has none. The overlay has to be inside it to stay on screen.
   */
  element?: Element;
};

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
  /**
   * Moves every control placed by numbers (the built-in layouts' included) away from or towards the
   * overlay's edges, e.g. `{ left: -2, right: -2 }` for driving controls closer to the sides of a
   * wide phone. 0 by default; `MobileControls.inset` changes it later. It sets the overlay's
   * `--gg-mc-inset-left`/`-right`/`-top`/`-bottom` custom properties, which a stylesheet can set too.
   */
  inset: MobileControlsInset;
  /**
   * Gates the overlay: hidden while it last emitted `false` and until it first emits, shown (if
   * enabled) while it last emitted `true` - e.g. "a car is driven and no menu is open". Hiding
   * releases whatever is held, so no key stays pressed. The same as setting `visible` on each value.
   */
  visible$: Observable<boolean> | null;
  /**
   * A pause button in the top left corner (`true`, or its options), on top of every layout. By
   * default it pauses the world and resumes it again (see `PauseButtonOptions.onPress`). `false` by
   * default; the button is `MobileControls.pauseButton`.
   */
  pauseButton: boolean | PauseButtonOptions;
  /**
   * A fullscreen button in the top right corner (`true`, or its options), on top of every layout,
   * toggling fullscreen through `toggleFullscreen`. It stays hidden where fullscreen is not
   * available (an iPhone). `false` by default; the button is `MobileControls.fullscreenButton`.
   */
  fullscreenButton: boolean | FullscreenButtonOptions;
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
  /** Options of the built-in layout for `ObjectGrabController`, or `false` to have none. */
  grab: GrabLayoutOptions | false;
};

const DEFAULT_OPTIONS: MobileControlsOptions = {
  enabled: 'auto',
  container: null,
  className: '',
  inset: 0,
  visible$: null,
  pauseButton: false,
  fullscreenButton: false,
  injectStyles: true,
  car: {},
  character: {},
  character2d: {},
  freeCamera: {},
  grab: {},
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
 * `CarHandlingController`), `PlayerCharacterController`, `PlayerCharacterController2d`,
 * `FreeCameraController` and `ObjectGrabController` (whose grab/release and throw buttons appear next
 * to the controls of the controller it is paired with). Each of those layouts is adjusted through
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

  /** The pause button (`MobileControlsOptions.pauseButton`), or `null`. */
  public readonly pauseButton: TouchButton | null = null;

  /** The fullscreen button (`MobileControlsOptions.fullscreenButton`), or `null`. */
  public readonly fullscreenButton: TouchButton | null = null;

  private readonly registrations: {
    controllerClass: ControllerClass<any>;
    factory: MobileControlsLayoutFactory<any>;
  }[] = [];
  private readonly tracked: Set<IEntity> = new Set<IEntity>();
  private readonly layouts: Map<IEntity, MobileControlsLayoutItem[]> = new Map<IEntity, MobileControlsLayoutItem[]>();
  private readonly ownControls: Set<TouchControl> = new Set<TouchControl>();
  /** controllers whose layout is to be rebuilt (their keys changed) once no finger is on it */
  private readonly stale: Set<IEntity> = new Set<IEntity>();
  private _enabled: boolean | 'auto';
  private _visible: boolean = true;
  private _inset: MobileControlsInset = 0;

  public get inset(): MobileControlsInset {
    return this._inset;
  }

  /** See `MobileControlsOptions.inset`. */
  public set inset(value: MobileControlsInset) {
    this._inset = value;
    const edges = typeof value === 'number' ? { left: value, right: value, top: value, bottom: value } : value;
    for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
      const offset = edges[edge] ?? 0;
      if (offset === 0) {
        // left to the stylesheet (0 when it sets nothing)
        this.element.style.removeProperty(`--gg-mc-inset-${edge}`);
      } else {
        this.element.style.setProperty(`--gg-mc-inset-${edge}`, `${offset}`);
      }
    }
  }

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
    this.inset = this.options.inset;
    this.releaseAll = this.releaseAll.bind(this);
    if (this.options.pauseButton) {
      this.pauseButton = this.createPauseButton(this.options.pauseButton === true ? {} : this.options.pauseButton);
    }
    if (this.options.fullscreenButton) {
      this.fullscreenButton = this.createFullscreenButton(
        this.options.fullscreenButton === true ? {} : this.options.fullscreenButton,
      );
    }
    if (this.options.visible$) {
      this._visible = false;
      this.options.visible$.pipe(takeUntil(this.disposed$)).subscribe(visible => (this.visible = visible));
    }
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
    if (this.options.grab) {
      this.registerLayout(ObjectGrabController, grabLayout(this.options.grab));
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
   * (the car it drives, an option), since a layout is otherwise built once per activation. Done at
   * once, releasing whatever the layout's controls hold. An `IRebindableController` (every
   * built-in one) is refreshed without this call when its `bindingsChanged$` reports a `'keys'`
   * change: at once, or - with a finger on one of its controls at that moment - as soon as the last
   * one lifts, so a rebind from elsewhere (a controls UI next to the game, a message over the network)
   * never takes a held button from under a finger.
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
    const pauseOptions = this.options.pauseButton === true ? {} : (this.options.pauseButton as PauseButtonOptions);
    // the default action's next effect; an app's own `onPress` keeps its icon
    if (this.pauseButton && !pauseOptions.onPress) {
      const pauseButton = this.pauseButton;
      const options = pauseOptions;
      const showState = () =>
        pauseButton.setContent(
          world.isPaused
            ? (options.resumeIcon ?? MobileControlsIcons.resume)
            : (options.icon ?? MobileControlsIcons.pause),
        );
      showState();
      world.worldClock.paused$.pipe(takeUntil(this._onRemoved$)).subscribe(showState);
    }
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

  private createPauseButton(options: PauseButtonOptions): TouchButton {
    const button = new TouchButton({
      id: 'pause',
      label: options.label ?? 'Pause',
      content: options.icon ?? MobileControlsIcons.pause,
      placement: mergeControlPlacement({ left: 4, top: 4, width: 7, height: 7 }, options.placement),
    }).onPress(() => {
      if (options.onPress) {
        options.onPress(this);
        return;
      }
      const world = this.world;
      if (!world) {
        return;
      }
      if (world.isPaused) {
        world.resumeWorld();
      } else if (world.localPauseAllowed) {
        world.pauseWorld();
      }
    });
    this.addControls(button);
    return button;
  }

  private createFullscreenButton(options: FullscreenButtonOptions): TouchButton {
    const target = () => options.element ?? this.options.container ?? document.documentElement;
    const button = new TouchButton({
      id: 'fullscreen',
      label: options.label ?? 'Fullscreen',
      content: options.icon ?? MobileControlsIcons.fullscreen,
      placement: mergeControlPlacement({ right: 4, top: 4, width: 7, height: 7 }, options.placement),
      // entering fullscreen needs a user gesture, which a touch grants on lifting the finger
    }).onTap(() => toggleFullscreen(target()));
    button.visible = isFullscreenAvailable(target());
    fullscreen$()
      .pipe(takeUntil(this.disposed$))
      .subscribe(on =>
        button.setContent(
          on
            ? (options.exitIcon ?? MobileControlsIcons.exitFullscreen)
            : (options.icon ?? MobileControlsIcons.fullscreen),
        ),
      );
    this.addControls(button);
    return button;
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
      } else if (this.stale.has(controller) && !this.layouts.get(controller)!.some(this.isTouched)) {
        // its keys changed: rebuilt now that no finger is on it (rebuilding would take the held
        // button from under the finger, and the finger's touch cannot move over to the new one)
        this.disposeLayout(controller);
      }
    }
    if (!show) {
      return;
    }
    for (const controller of this.tracked) {
      if (controller.active && !this.layouts.has(controller)) {
        const items = this.findFactory(controller)!(controller, { world: world!, controls: this });
        // the built-in controllers' `setKeys`: the layout's buttons press keys read when it was built.
        // Not on a gamepad change, which the layout doesn't read
        if (isRebindableController(controller)) {
          const subscription = controller.bindingsChanged$.pipe(filter(change => change === 'keys')).subscribe(() => {
            this.stale.add(controller);
            // `sync` runs on every tick too, for a layout held at this moment
            this.sync();
          });
          items.push({ dispose: () => subscription.unsubscribe() });
        }
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

  private readonly isTouched = (item: MobileControlsLayoutItem): boolean =>
    item instanceof TouchControl && item.touched;

  private disposeLayout(controller: IEntity): void {
    this.stale.delete(controller);
    const items = this.layouts.get(controller);
    if (items) {
      this.layouts.delete(controller);
      for (const item of items) {
        item.dispose();
      }
    }
  }
}
