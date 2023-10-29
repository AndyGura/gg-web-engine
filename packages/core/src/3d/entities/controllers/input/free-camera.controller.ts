import { combineLatest, filter, takeUntil } from 'rxjs';
import {
  DirectionKeyboardInput,
  DirectionKeyboardKeymap,
  DirectionKeyboardOutput,
  IEntity,
  TickOrder,
  GgWorld,
  KeyboardInput,
  MouseInput,
  MouseInputOptions,
  MutableSpherical,
  Pnt2,
  Pnt3,
  Point2,
  Qtrn,
} from '../../../../base';
import { Renderer3dEntity } from '../../renderer-3d.entity';

/**
 * Options for configuring a FreeCameraInput controller.
 */
export type FreeCameraControllerOptions = {
  /**
   * A keymap for controlling camera movement, where each key corresponds to a movement direction.
   */
  keymap: DirectionKeyboardKeymap;
  /**
   * Options for configuring camera movement.
   */
  movementOptions: {
    /**
     * The speed of camera movement.
     */
    speed: number;
  };
  /**
   * Flag to ignore cursor movement if pointer was not locked. By default false
   */
  ignoreMouseUnlessPointerLocked: boolean;
  /**
   * Flag to ignore keyboard events if pointer was not locked. By default false
   */
  ignoreKeyboardUnlessPointerLocked: boolean;
  /**
   * Options for configuring mouse input.
   */
  mouseOptions: Partial<MouseInputOptions>;
};

/**
 * A controller for a free-moving camera.
 */
export class FreeCameraController extends IEntity {
  public readonly tickOrder = TickOrder.INPUT_CONTROLLERS;

  /**
   * The mouse input controller used for camera rotation.
   */
  protected readonly mouseInput: MouseInput;
  /**
   * The keyboard input controller used for camera movement.
   */
  protected readonly directionsInput: DirectionKeyboardInput;

  /**
   * Creates a new FreeCameraInput instance.
   * @param keyboard The keyboard input controller to use for camera movement.
   * @param camera The camera entity to control.
   * @param options Optional configuration options for the controller.
   */
  constructor(
    protected readonly keyboard: KeyboardInput,
    protected readonly camera: Renderer3dEntity,
    protected readonly options: FreeCameraControllerOptions = {
      keymap: 'wasd',
      movementOptions: { speed: 0.5 },
      mouseOptions: {},
      ignoreMouseUnlessPointerLocked: false,
      ignoreKeyboardUnlessPointerLocked: false,
    },
  ) {
    super();
    this.mouseInput = new MouseInput(options.mouseOptions);
    this.directionsInput = new DirectionKeyboardInput(keyboard, options.keymap);
  }

  async onSpawned(world: GgWorld<any, any>): Promise<void> {
    await super.onSpawned(world);
    // Subscribe to keyboard input for movement controls
    let controls: { direction: DirectionKeyboardOutput; rest: boolean[] } = { direction: {}, rest: [] };
    const keys = ['KeyE', 'KeyQ'];
    if (this.camera.camera.supportsFov) {
      keys.push('KeyZ', 'KeyC');
    }
    keys.push('ShiftLeft');
    this.directionsInput.output$.pipe(takeUntil(this._onRemoved$)).subscribe(d => {
      controls.direction = d;
    });
    combineLatest(keys.map(c => this.keyboard.bind(c)))
      .pipe(takeUntil(this._onRemoved$))
      .subscribe((d: boolean[]) => {
        controls.rest = d;
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
    this.camera.tick$.pipe(takeUntil(this._onRemoved$)).subscribe(() => {
      let c = controls;
      if (this.options.ignoreKeyboardUnlessPointerLocked && !this.mouseInput.isPointerLocked) {
        c = { direction: {}, rest: [false, false, false, false, false] };
      }
      let translateVector = { ...Pnt3.O } as { x: number; y: number; z: number };
      const [u, d, zo, zi, speedBoost] = c.rest;
      if (c.direction.upDown !== undefined) translateVector.z = c.direction.upDown ? -1 : 1;
      if (c.direction.leftRight !== undefined) translateVector.x = c.direction.leftRight ? -1 : 1;
      if (u != d) translateVector.y = d ? -1 : 1;
      if (zo != zi) this.camera.camera.fov += zo ? 1 : -1;
      let speed = this.options.movementOptions.speed;
      if (speedBoost) {
        speed *= 2.5;
      }
      this.camera.position = Pnt3.add(
        this.camera.position,
        Pnt3.rot(Pnt3.scalarMult(Pnt3.norm(translateVector), speed), this.camera.rotation),
      );
      if (rotationDelta.x != 0 || rotationDelta.y != 0) {
        const spherical: MutableSpherical = Pnt3.toSpherical(Pnt3.rot({ x: 0, y: 0, z: -1 }, this.camera.rotation));
        spherical.theta -= rotationDelta.x / 300;
        spherical.phi += rotationDelta.y / 300;
        spherical.phi = Math.max(0.000001, Math.min(Math.PI - 0.000001, spherical.phi));
        this.camera.rotation = Qtrn.lookAt(
          this.camera.position,
          Pnt3.add(this.camera.position, Pnt3.fromSpherical(spherical)),
        );
        rotationDelta = Pnt2.O;
      }
    });

    // start input
    await this.mouseInput.start();
    await this.directionsInput.start();
  }

  async onRemoved(): Promise<void> {
    await super.onRemoved();
    await this.mouseInput.stop(true);
    await this.directionsInput.stop();
  }
}
