import { BehaviorSubject, combineLatest, filter, Subject, takeUntil } from 'rxjs';
import {
  DirectionInput,
  DirectionKeymap,
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
import { map } from 'rxjs/operators';

/**
 * Options for configuring a FreeCameraInput controller.
 */
export type FreeCameraControllerOptions = {
  /**
   * A keymap for controlling camera movement, where each key corresponds to a movement direction. 'wasd' by default
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
   * A linear speed multiplier when user holds shift key. 2.5 by default
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
   * touch device, like `ignoreMouseUnlessPointerLocked`
   */
  ignoreKeyboardUnlessPointerLocked: boolean;
  /**
   * Options for configuring mouse input.
   */
  mouseOptions: Partial<MouseInputOptions>;
};

/** How fast the zoom keys change the camera's field of view, in degrees per second. */
const FOV_CHANGE_PER_SECOND = 60;

const DEFAULT_FREE_CAMERA_CONTROLLER_OPTIONS: FreeCameraControllerOptions = {
  keymap: 'wasd',
  cameraLinearSpeed: 20,
  cameraMovementElasticity: 0,
  cameraBoostMultiplier: 2.5,
  cameraRotationSensitivity: 2,
  cameraRotationElasticity: 0,
  mouseOptions: {},
  ignoreMouseUnlessPointerLocked: false,
  ignoreKeyboardUnlessPointerLocked: false,
};

/**
 * A controller for a free-moving camera.
 */
export class FreeCameraController extends IEntity {
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
  }

  public reset(): void {
    this._spherical = Pnt3.toSpherical(Pnt3.rot({ x: 0, y: 0, z: -1 }, this.camera.rotation));
    this.resetMotion$.next();
  }

  async onSpawned(world: GgWorld<any, any>): Promise<void> {
    await super.onSpawned(world);
    this._spherical = Pnt3.toSpherical(Pnt3.rot({ x: 0, y: 0, z: -1 }, this.camera.rotation));
    // Subscribe to keyboard input for movement controls
    const keys = ['KeyE', 'KeyQ'];
    if (this.camera.camera.supportsFov) {
      keys.push('KeyZ', 'KeyC');
    }
    keys.push('ShiftLeft');
    // a touch screen has no pointer lock, so neither "unless pointer locked" option applies to it
    const isTouchScreen = MouseInput.isTouchDevice();

    let controlsObs = combineLatest([this.directionsInput.direction$, ...keys.map(c => this.keyboard.bind(c))]).pipe(
      takeUntil(this._onRemoved$),
      map(([direction, ...rest]) => {
        let c: { direction: Point2; rest: boolean[] } = { direction: Pnt2.O, rest: [] };
        if (!this.options.ignoreKeyboardUnlessPointerLocked || this.mouseInput.isPointerLocked || isTouchScreen) {
          c = { direction, rest };
        }
        let translate = { ...Pnt3.O } as { x: number; y: number; z: number };
        const [u, d, zo, zi, speedBoost] = c.rest;
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

    // Subscribe to mouse input for camera rotation
    let mouseDelta$ = this.mouseInput.delta$.pipe(
      takeUntil(this._onRemoved$),
      filter(
        () =>
          this.active &&
          (isTouchScreen || !this.options.ignoreMouseUnlessPointerLocked || this.mouseInput.isPointerLocked),
      ),
    );
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

    // Setup updating camera position and rotation based on input
    this.camera.tick$
      .pipe(
        takeUntil(this._onRemoved$),
        filter(() => this.active),
      )
      .subscribe(([_, delta]) => {
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
