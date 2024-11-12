import { combineLatest, filter, takeUntil } from 'rxjs';
import {
  DirectionKeyboardInput,
  DirectionKeyboardKeymap,
  DirectionKeyboardOutput,
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
  TickOrder,
} from '../../../../base';
import { Renderer3dEntity } from '../../renderer-3d.entity';
import { map } from 'rxjs/operators';
import ggElastic from '../../../../base/pipes/gg-elastic.pipe';

/**
 * Options for configuring a FreeCameraInput controller.
 */
export type FreeCameraControllerOptions = {
  /**
   * A keymap for controlling camera movement, where each key corresponds to a movement direction. 'wasd' by default
   */
  keymap: DirectionKeyboardKeymap;
  /**
   * The speed of camera movement in meters per second. 20 by default
   */
  cameraLinearSpeed: number;
  /**
   * A linear speed multiplier when user holds shift key. 2.5 by default
   */
  cameraBoostMultiplier: number;
  /**
   * The speed of camera rotation in radians per 1000px mouse movement. 1 by default
   */
  cameraRotationMultiplier: number;
  /**
   * Flag to ignore cursor movement if pointer was not locked. false by default
   */
  ignoreMouseUnlessPointerLocked: boolean;
  /**
   * Flag to ignore keyboard events if pointer was not locked. false by default
   */
  ignoreKeyboardUnlessPointerLocked: boolean;
  /**
   * Options for configuring mouse input.
   */
  mouseOptions: Partial<MouseInputOptions>;
};

const DEFAULT_FREE_CAMERA_CONTROLLER_OPTIONS: FreeCameraControllerOptions = {
  keymap: 'wasd',
  cameraLinearSpeed: 20,
  cameraBoostMultiplier: 2.5,
  cameraRotationMultiplier: 1,
  mouseOptions: {},
  ignoreMouseUnlessPointerLocked: false,
  ignoreKeyboardUnlessPointerLocked: false,
};

/**
 * A controller for a free-moving camera.
 */
export class FreeCameraController extends IEntity {
  public readonly tickOrder = TickOrder.INPUT_CONTROLLERS;

  protected readonly options: FreeCameraControllerOptions;

  /**
   * The mouse input controller used for camera rotation.
   */
  public readonly mouseInput: MouseInput;
  /**
   * The keyboard input controller used for camera movement.
   */
  public readonly directionsInput: DirectionKeyboardInput;

  /**
   * Creates a new FreeCameraInput instance.
   * @param keyboard The keyboard input controller to use for camera movement.
   * @param camera The camera entity to control.
   * @param options Optional configuration options for the controller.
   */
  constructor(
    protected readonly keyboard: KeyboardInput,
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
    this.directionsInput = new DirectionKeyboardInput(keyboard, this.options.keymap);
  }

  async onSpawned(world: GgWorld<any, any>): Promise<void> {
    await super.onSpawned(world);
    // Subscribe to keyboard input for movement controls
    const keys = ['KeyE', 'KeyQ'];
    if (this.camera.camera.supportsFov) {
      keys.push('KeyZ', 'KeyC');
    }
    keys.push('ShiftLeft');

    let translateVector: Point3 = Pnt3.O;
    let cameraFovInc: number = 0;
    combineLatest([this.directionsInput.output$, ...keys.map(c => this.keyboard.bind(c))])
      .pipe(
        takeUntil(this._onRemoved$),
        map(([direction, ...rest]) => {
          let c: { direction: DirectionKeyboardOutput; rest: boolean[] } = { direction: {}, rest: [] };
          if (!this.options.ignoreKeyboardUnlessPointerLocked || this.mouseInput.isPointerLocked) {
            c = { direction, rest };
          }
          let translate = { ...Pnt3.O } as { x: number; y: number; z: number };
          const [u, d, zo, zi, speedBoost] = c.rest;
          if (c.direction.upDown !== undefined) translate.z = c.direction.upDown ? -1 : 1;
          if (c.direction.leftRight !== undefined) translate.x = c.direction.leftRight ? -1 : 1;
          if (u != d) translate.y = d ? -1 : 1;
          let cameraFovInc = 0;
          if (zo != zi) cameraFovInc = zo ? 1 : -1;
          translate = Pnt3.norm(translate);
          if (speedBoost) {
            translate = Pnt3.scalarMult(translate, this.options.cameraBoostMultiplier);
          }
          console.log('######', JSON.stringify(translate));
          return [translate, cameraFovInc] as [Point3, number];
        }),
        ggElastic(
          this.camera.tick$,
          500,
          ([at, _], [bt, bf], f) => ([Pnt3.lerp(at, bt, f), bf] as [Point3, number]),
          ([at, af], [bt, bf]) => af == bf && Pnt3.dist(at, bt) < 0.001,
        ),
      )
      .subscribe(([t, f]) => {
        console.log('$$$$$', JSON.stringify(t));
        translateVector = t;
        cameraFovInc = f;
      });

    // Subscribe to mouse input for camera rotation
    let rotationDelta: Point2 = Pnt2.O;
    let isTouchScreen = MouseInput.isTouchDevice();
    this.mouseInput.delta$
      .pipe(
        takeUntil(this._onRemoved$),
        filter(() => isTouchScreen || !this.options.ignoreMouseUnlessPointerLocked || this.mouseInput.isPointerLocked),
      )
      .subscribe(delta => {
        rotationDelta = Pnt2.add(rotationDelta, delta);
      });

    // Setup updating camera position and rotation based on input
    this.camera.tick$.pipe(takeUntil(this._onRemoved$)).subscribe(([_, delta]) => {
      this.camera.camera.fov += cameraFovInc;
      this.camera.position = Pnt3.add(
        this.camera.position,
        Pnt3.rot(Pnt3.scalarMult(translateVector, (this.options.cameraLinearSpeed * delta) / 1000), this.camera.rotation),
      );
      if (rotationDelta.x != 0 || rotationDelta.y != 0) {
        const spherical: MutableSpherical = Pnt3.toSpherical(Pnt3.rot({ x: 0, y: 0, z: -1 }, this.camera.rotation));
        spherical.theta -= (rotationDelta.x * this.options.cameraRotationMultiplier) / 1000;
        spherical.phi += (rotationDelta.y * this.options.cameraRotationMultiplier) / 1000;
        spherical.phi = Math.max(0.000001, Math.min(Math.PI - 0.000001, spherical.phi));
        this.camera.rotation = Qtrn.lookAt(
          this.camera.position,
          Pnt3.add(this.camera.position, Pnt3.fromSpherical(spherical)),
        );
        rotationDelta = Pnt2.O;
      }
    });

    // start input
    this.mouseInput.start();
    this.directionsInput.start();
  }

  async onRemoved(): Promise<void> {
    await super.onRemoved();
    await this.mouseInput.stop(true);
    await this.directionsInput.stop();
  }
}
