import { BehaviorSubject, combineLatest, filter, merge, Observable, of, Subject, switchMap, takeUntil } from 'rxjs';
import {
  DirectionInput,
  DirectionKeymap,
  BindingsChange,
  ControllerBindings,
  IRebindableController,
  sameBinding,
  GAMEPAD_LEFT_STICK_OR_DPAD,
  GAMEPAD_RIGHT_STICK,
  GamepadControls,
  GamepadDirectionBinding,
  ggElastic,
  GgWorld,
  IEntity,
  KeyboardInput,
  MouseInput,
  MouseInputOptions,
  MutableSpherical,
  Pnt2,
  Pnt3,
  Point2,
  Point3,
  Qtrn,
  runWhileInputEnabled,
  Spherical,
  TickOrder,
} from '../../../../base';
import { Renderer3dEntity } from '../../renderer-3d.entity';
import { distinctUntilChanged, map } from 'rxjs/operators';

/** Which gamepad controls fly the camera - see `GamepadControl` for the control names */
export type FreeCameraGamepadBinding = {
  /** The movement direction, added to the direction input */
  move: GamepadDirectionBinding;
  /** The look direction: turns the view at `lookSpeed` at full deflection */
  look: GamepadDirectionBinding;
  /** How fast `look` turns the view at full deflection, in radians per second */
  lookSpeed: number;
  /** Presses the up key (`upDownKeys[0]`) */
  up: GamepadControls;
  /** Presses the down key (`upDownKeys[1]`) */
  down: GamepadControls;
  /** Presses `boostKey` */
  boost: GamepadControls;
};

/** Left stick or d-pad moves, right stick looks, RB/LB go up/down, the left stick's click boosts */
export const DEFAULT_FREE_CAMERA_GAMEPAD_BINDING: FreeCameraGamepadBinding = {
  move: GAMEPAD_LEFT_STICK_OR_DPAD,
  look: GAMEPAD_RIGHT_STICK,
  lookSpeed: 3,
  up: 'b5',
  down: 'b4',
  boost: 'b10',
};

/**
 * Options for configuring a FreeCameraInput controller.
 */
export type FreeCameraControllerOptions = {
  /**
   * A keymap for controlling camera movement, where each key corresponds to a movement direction:
   * `'wasd'` by default, or custom codes per direction. `setKeys` changes it while the game runs.
   */
  keymap: DirectionKeymap;
  /**
   * The speed of camera movement in meters per second. 20 by default
   */
  cameraLinearSpeed: number;
  /**
   * An elasticity factor for camera movement. 0 by default (no elastic motion)
   */
  cameraMovementElasticity: number;
  /**
   * Key codes flying the camera up and down. `['KeyE', 'KeyQ']` by default
   */
  upDownKeys: [string, string];
  /**
   * Key codes narrowing and widening the field of view, for a camera that has one. `['KeyZ',
   * 'KeyC']` by default (Z zooms out, C in)
   */
  zoomOutInKeys: [string, string];
  /**
   * Key code multiplying the speed by `cameraBoostMultiplier` while held. `'ShiftLeft'` by default
   */
  boostKey: string;
  /**
   * A linear speed multiplier while `boostKey` is held. 2.5 by default
   */
  cameraBoostMultiplier: number;
  /**
   * The speed of camera rotation in radians per 1000px mouse movement. 1 by default
   */
  cameraRotationSensitivity: number;
  /**
   * An elasticity factor for camera rotation. 0 by default (no elastic motion)
   */
  cameraRotationElasticity: number;
  /**
   * Flag to ignore cursor movement if pointer was not locked. false by default
   */
  ignoreMouseUnlessPointerLocked: boolean;
  /**
   * Flag to ignore keyboard events if pointer was not locked. false by default. Always ignored on a
   * touch device, like `ignoreMouseUnlessPointerLocked`, and while the gamepad is the device in use
   * (`gamepadInput.inUse`) or has its `move` direction or one of its buttons pushed: the gate is
   * against stray typing over the page, not against a gamepad
   */
  ignoreKeyboardUnlessPointerLocked: boolean;
  /**
   * Options for configuring mouse input.
   */
  mouseOptions: Partial<MouseInputOptions>;
  /**
   * The gamepad controls, bound on the world's `gamepadInput`: `move` goes to the direction input,
   * `look` turns the view (regardless of `ignoreMouseUnlessPointerLocked`), the buttons press the
   * up/down/boost keys on `keyboard`. `DEFAULT_FREE_CAMERA_GAMEPAD_BINDING` by default; `null`
   * leaves the gamepad alone. `setGamepad` changes it while the game runs.
   */
  gamepad: FreeCameraGamepadBinding | null;
};

/** How fast the zoom keys change the camera's field of view, in degrees per second. */
const FOV_CHANGE_PER_SECOND = 60;

const DEFAULT_FREE_CAMERA_CONTROLLER_OPTIONS: FreeCameraControllerOptions = {
  keymap: 'wasd',
  upDownKeys: ['KeyE', 'KeyQ'],
  zoomOutInKeys: ['KeyZ', 'KeyC'],
  boostKey: 'ShiftLeft',
  cameraLinearSpeed: 20,
  cameraMovementElasticity: 0,
  cameraBoostMultiplier: 2.5,
  cameraRotationSensitivity: 2,
  cameraRotationElasticity: 0,
  mouseOptions: {},
  ignoreMouseUnlessPointerLocked: false,
  ignoreKeyboardUnlessPointerLocked: false,
  gamepad: DEFAULT_FREE_CAMERA_GAMEPAD_BINDING,
};

/**
 * The keys of a `FreeCameraController`, which `setKeys` changes while the game runs
 */
export type FreeCameraControllerKeys = Pick<
  FreeCameraControllerOptions,
  'keymap' | 'upDownKeys' | 'zoomOutInKeys' | 'boostKey'
>;

/**
 * A controller for a free-moving camera: fly with WASD (or another `keymap`), `E`/`Q` up and
 * down, `Shift` to boost, `Z`/`C` to zoom, and mouse-look (every key in `options`). Typical for a debug fly-through or a spectator view.
 *
 * @example
 * ```ts
 * import { FreeCameraController } from '@gg-web-engine/core';
 *
 * const canvas = document.getElementById('gg') as HTMLCanvasElement;
 * const renderer = world.addRenderer(world.visualScene.factory.createPerspectiveCamera(), canvas);
 * renderer.position = { x: 0, y: -10, z: 2 }; // 3D is Z-up: 2 m above the ground
 *
 * world.addEntity(
 *   new FreeCameraController(world.keyboardInput, renderer, {
 *     cameraLinearSpeed: 10, // m/s
 *     mouseOptions: { canvas, pointerLock: true }, // click the canvas to look around
 *     ignoreMouseUnlessPointerLocked: true,
 *   }),
 * );
 * ```
 */
export class FreeCameraController extends IEntity implements IRebindableController {
  static readonly entityTypeName: string = 'FreeCameraController';
  public readonly tickOrder = TickOrder.INPUT_CONTROLLERS;

  public readonly options: FreeCameraControllerOptions;

  /**
   * The mouse input controller used for camera rotation.
   */
  public readonly mouseInput: MouseInput;
  /**
   * The keyboard input controller used for camera movement.
   */
  public readonly directionsInput: DirectionInput;

  private readonly bindings: ControllerBindings<FreeCameraControllerOptions, FreeCameraGamepadBinding>;

  /** Emits after every `setKeys` (`'keys'`) and `setGamepad` (`'gamepad'`) - see `IRebindableController` */
  public get bindingsChanged$(): Observable<BindingsChange> {
    return this.bindings.changed$;
  }

  /**
   * Rebinds keys while the game runs - for a controls menu. Only the keys given change; they are
   * written to `options` and take effect at once, keyboard and gamepad alike (the gamepad presses
   * whichever key its button is for). A key held while it is replaced stops counting, and a new
   * key already held counts from its next press.
   *
   * @example
   * ```ts
   * camera.setKeys({ upDownKeys: ['Space', 'KeyC'], zoomOutInKeys: ['Minus', 'Equal'] });
   * ```
   */
  public setKeys(keys: Partial<FreeCameraControllerKeys>): void {
    this.bindings.setKeys(keys);
  }

  /**
   * Rebinds the gamepad while the game runs - for a controls menu. The controls given replace the
   * current ones (over `DEFAULT_FREE_CAMERA_GAMEPAD_BINDING` while the gamepad is off), `null` turns the
   * gamepad off. Written to `options.gamepad`, taking effect at once. A control held while it is
   * replaced stops counting, and one already held when it is assigned (the button a menu just
   * captured) counts from its next push.
   *
   * @example
   * ```ts
   * camera.setGamepad({ up: 'b3', down: 'b0' });
   * ```
   */
  public setGamepad(binding: Partial<FreeCameraGamepadBinding> | null): void {
    this.bindings.setGamepad(binding);
  }

  protected _spherical: MutableSpherical = { phi: 0, radius: 1, theta: 0 };

  get active(): boolean {
    return super.active;
  }

  set active(value: boolean) {
    if (!super.active && value) {
      this.reset();
    }
    super.active = value;
  }

  public get spherical(): Spherical {
    return this._spherical;
  }

  public set spherical(value: Spherical) {
    this._spherical.phi = Math.max(0.000001, Math.min(Math.PI - 0.000001, value.phi));
    this._spherical.theta = value.theta;
    this.resetMotion$.next();
  }

  protected resetMotion$: Subject<void> = new Subject<void>();

  /**
   * Creates a new FreeCameraInput instance.
   * @param keyboard The keyboard input controller to use for camera movement.
   * @param camera The camera entity to control.
   * @param options Optional configuration options for the controller.
   */
  constructor(
    public readonly keyboard: KeyboardInput,
    protected readonly camera: Renderer3dEntity,
    options: Partial<FreeCameraControllerOptions> = {},
  ) {
    super();
    this.options = {
      ...DEFAULT_FREE_CAMERA_CONTROLLER_OPTIONS,
      ...options,
    };
    if (options.mouseOptions) {
      this.options.mouseOptions = {
        ...DEFAULT_FREE_CAMERA_CONTROLLER_OPTIONS.mouseOptions,
        ...options.mouseOptions,
      };
    }
    this.mouseInput = new MouseInput(this.options.mouseOptions);
    this.directionsInput = new DirectionInput(keyboard, this.options.keymap);
    this.bindings = new ControllerBindings(this.options, DEFAULT_FREE_CAMERA_GAMEPAD_BINDING, this._onRemoved$);
  }

  public reset(): void {
    this._spherical = Pnt3.toSpherical(Pnt3.rot({ x: 0, y: 0, z: -1 }, this.camera.rotation));
    this.resetMotion$.next();
  }

  async onSpawned(world: GgWorld<any, any>): Promise<void> {
    await super.onSpawned(world);
    this.bindings.followKeymap(this.directionsInput, o => o.keymap);
    this._spherical = Pnt3.toSpherical(Pnt3.rot({ x: 0, y: 0, z: -1 }, this.camera.rotation));
    // Subscribe to keyboard input for movement controls: up, down, boost and, for a camera with a
    // fov, zoom out and in
    const keys$ = [
      this.bindings.followKey(this.keyboard, o => o.upDownKeys[0]),
      this.bindings.followKey(this.keyboard, o => o.upDownKeys[1]),
      this.bindings.followKey(this.keyboard, o => o.boostKey),
      this.bindings.followKey(this.keyboard, o => (this.camera.camera.supportsFov ? o.zoomOutInKeys[0] : null)),
      this.bindings.followKey(this.keyboard, o => (this.camera.camera.supportsFov ? o.zoomOutInKeys[1] : null)),
    ];
    // a touch screen has no pointer lock, so neither "unless pointer locked" option applies to it
    const isTouchScreen = MouseInput.isTouchDevice();
    const gamepadInput = world.gamepadInput;

    // the gamepad's moves and keys come through the same inputs, and are not stray typing. A stick
    // held still is not "in use" once a key is tapped (`inUse` hands over to the keyboard), so what
    // is pushed on the gamepad right now opens the gate too, and a held stick keeps flying
    const gamepadActive$: Observable<boolean> = gamepadInput
      ? this.bindings
          .option$(o => o.gamepad)
          .pipe(
            // `setKeys` emits too, and must not resubscribe
            distinctUntilChanged(sameBinding),
            switchMap(gamepad =>
              gamepad
                ? combineLatest([
                    gamepadInput.inUse$,
                    gamepadInput.direction$(gamepad.move),
                    gamepadInput.pressed$([gamepad.up, gamepad.down, gamepad.boost].flat()),
                  ]).pipe(map(([inUse, move, pressed]) => inUse || move.x !== 0 || move.y !== 0 || pressed))
                : of(false),
            ),
            distinctUntilChanged(),
          )
      : of(false);
    let controlsObs = combineLatest([this.directionsInput.direction$, gamepadActive$, ...keys$]).pipe(
      takeUntil(this._onRemoved$),
      map(([direction, gamepadInUse, ...rest]) => {
        let c: { direction: Point2; rest: boolean[] } = { direction: Pnt2.O, rest: [] };
        if (
          !this.options.ignoreKeyboardUnlessPointerLocked ||
          this.mouseInput.isPointerLocked ||
          isTouchScreen ||
          gamepadInUse
        ) {
          c = { direction, rest };
        }
        let translate = { ...Pnt3.O } as { x: number; y: number; z: number };
        // the zoom keys are never held for a camera without a fov
        const [u, d, speedBoost, zo, zi] = c.rest;
        translate.z = c.direction.y === 0 ? 0 : -c.direction.y;
        translate.x = c.direction.x;
        if (u != d) translate.y = d ? -1 : 1;
        let cameraFovInc = 0;
        if (zo != zi) cameraFovInc = zo ? 1 : -1;
        // an analog direction shorter than 1 moves the camera proportionally slower
        if (Pnt3.len(translate) > 1) {
          translate = Pnt3.norm(translate);
        }
        if (speedBoost) {
          translate = Pnt3.scalarMult(translate, this.options.cameraBoostMultiplier);
        }
        return [translate, cameraFovInc] as [Point3, number];
      }),
    );
    if (this.options.cameraMovementElasticity > 0) {
      controlsObs = controlsObs.pipe(
        ggElastic(
          this.camera.tick$,
          this.options.cameraMovementElasticity,
          ([at, _], [bt, bf], f) => [Pnt3.lerp(at, bt, f), bf] as [Point3, number],
          ([at, af], [bt, bf]) => af == bf && Pnt3.dist(at, bt) < 0.001,
        ),
      );
    }

    let translateVector: Point3 = Pnt3.O;
    let cameraFovInc: number = 0;
    controlsObs.subscribe(([t, f]) => {
      translateVector = t;
      cameraFovInc = f;
    });

    // Subscribe to mouse input for camera rotation. A gamepad's look is fed into the same path, as
    // the mouse movement that turns the view by the same angle, so both react to the elasticity
    // alike; it skips the pointer-lock gate, which is about stray mouse movement over the page.
    const gamepadLook$ = new Subject<Point2>();
    let mouseDelta$ = merge(
      this.mouseInput.delta$.pipe(
        filter(
          () =>
            this.active &&
            (isTouchScreen || !this.options.ignoreMouseUnlessPointerLocked || this.mouseInput.isPointerLocked),
        ),
      ),
      gamepadLook$,
    ).pipe(takeUntil(this._onRemoved$));
    if (this.options.cameraRotationElasticity > 0) {
      const s$: BehaviorSubject<Spherical> = new BehaviorSubject(this._spherical);
      mouseDelta$.subscribe(delta => {
        const s = s$.getValue();
        s$.next({
          phi: Math.max(
            0.000001,
            Math.min(Math.PI - 0.000001, s.phi + (delta.y * this.options.cameraRotationSensitivity) / 1000),
          ),
          theta: s.theta - (delta.x * this.options.cameraRotationSensitivity) / 1000,
          radius: 1,
        });
      });
      const startElasticMotion = () => {
        s$.pipe(
          takeUntil(this._onRemoved$),
          ggElastic(
            this.tick$,
            this.options.cameraRotationElasticity,
            (a, b, f) => ({ phi: a.phi + f * (b.phi - a.phi), theta: a.theta + f * (b.theta - a.theta), radius: 1 }),
            (a, b) => Pnt2.dist({ x: a.phi, y: a.theta }, { x: b.phi, y: b.theta }) < 0.0001,
          ),
          takeUntil(this.resetMotion$),
        ).subscribe(s => {
          this._spherical.theta = s.theta;
          this._spherical.phi = s.phi;
        });
      };
      this.resetMotion$.pipe(takeUntil(this._onRemoved$)).subscribe(() => {
        s$.next(this._spherical);
        startElasticMotion();
      });
      startElasticMotion();
    } else {
      mouseDelta$.subscribe(delta => {
        this._spherical.theta -= (delta.x * this.options.cameraRotationSensitivity) / 1000;
        this._spherical.phi += (delta.y * this.options.cameraRotationSensitivity) / 1000;
        this._spherical.phi = Math.max(0.000001, Math.min(Math.PI - 0.000001, this._spherical.phi));
      });
    }

    if (gamepadInput) {
      this.bindings.followGamepadKey(
        gamepadInput,
        this.keyboard,
        o => o.upDownKeys[0],
        g => g.up,
      );
      this.bindings.followGamepadKey(
        gamepadInput,
        this.keyboard,
        o => o.upDownKeys[1],
        g => g.down,
      );
      this.bindings.followGamepadKey(
        gamepadInput,
        this.keyboard,
        o => o.boostKey,
        g => g.boost,
      );
      this.bindings.followGamepadDirection(gamepadInput, this.directionsInput, g => g.move);
    }

    // Setup updating camera position and rotation based on input
    this.camera.tick$
      .pipe(
        takeUntil(this._onRemoved$),
        filter(() => this.active),
      )
      .subscribe(([_, delta]) => {
        const gamepad = this.options.gamepad;
        if (gamepad && gamepadInput && this.directionsInput.running && this.options.cameraRotationSensitivity > 0) {
          // the stick turns the view at a rate, so it is applied per tick, scaled by the tick's time
          const look = gamepadInput.direction(gamepad.look);
          if (look.x !== 0 || look.y !== 0) {
            // `cameraRotationSensitivity` is radians per 1000px: the pixels for this tick's angle
            const px = (gamepad.lookSpeed * delta) / this.options.cameraRotationSensitivity;
            gamepadLook$.next({ x: look.x * px, y: -look.y * px });
          }
        }
        this.camera.camera.fov += (cameraFovInc * FOV_CHANGE_PER_SECOND * delta) / 1000;
        this.camera.position = Pnt3.add(
          this.camera.position,
          Pnt3.rot(
            Pnt3.scalarMult(translateVector, (this.options.cameraLinearSpeed * delta) / 1000),
            this.camera.rotation,
          ),
        );
        this.camera.rotation = Qtrn.lookAt(
          this.camera.position,
          Pnt3.add(this.camera.position, Pnt3.fromSpherical(this._spherical)),
        );
      });

    // start input
    runWhileInputEnabled(
      world,
      this._onRemoved$,
      () => {
        this.mouseInput.start();
        this.directionsInput.start();
      },
      () => {
        this.mouseInput.stop(true);
        this.directionsInput.stop();
      },
    );
  }

  async onRemoved(): Promise<void> {
    await super.onRemoved();
    await this.mouseInput.stop(true);
    await this.directionsInput.stop();
  }
}
