import { Input } from '../../../../base/inputs/input';
import { combineLatest, Subject, takeUntil } from 'rxjs';
import { MouseControllerOptions, MouseInput } from '../../../../base/inputs/mouse.input';
import { Pnt3 } from '../../../../base/math/point3';
import { Gg3dCameraEntity } from '../../gg-3d-camera.entity';
import { KeyboardInput } from '../../../../base/inputs/keyboard.input';
import { Pnt2 } from '../../../../base/math/point2';
import { Point2 } from '../../../../base/models/points';
import { Qtrn } from '../../../../base/math/quaternion';
import {
  DirectionKeyboardInput,
  DirectionKeyboardKeymap,
  DirectionKeyboardOutput,
} from '../../../../base/inputs/direction.keyboard-input';
import { GgEntity } from '../../../../base/entities/gg-entity';
import { GGTickOrder, ITickListener } from '../../../../base/entities/interfaces/i-tick-listener';

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
   * Options for configuring mouse input.
   */
  mouseOptions: MouseControllerOptions;
};

/**
 * A controller for a free-moving camera.
 */
export class FreeCameraController extends GgEntity implements ITickListener {
  public readonly tick$: Subject<[number, number]> = new Subject<[number, number]>();
  public readonly tickOrder = GGTickOrder.INPUT_CONTROLLERS;

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
    protected readonly camera: Gg3dCameraEntity,
    protected readonly options: FreeCameraControllerOptions = {
      keymap: 'wasd',
      movementOptions: { speed: 0.5 },
      mouseOptions: {},
    },
  ) {
    super();
    this.mouseInput = new MouseInput(options.mouseOptions);
    this.directionsInput = new DirectionKeyboardInput(keyboard, options.keymap);
  }

  async onSpawned(): Promise<void> {
    // Subscribe to keyboard input for movement controls
    let controls: { direction: DirectionKeyboardOutput; rest: boolean[] } = { direction: {}, rest: [] };
    const keys = ['KeyE', 'KeyQ'];
    if (this.camera.object3D.supportsFov) {
      keys.push('KeyZ', 'KeyC');
    }
    this.directionsInput.output$.pipe(takeUntil(this._onRemoved$)).subscribe(d => {
      controls.direction = d;
    });
    combineLatest(keys.map(c => this.keyboard.bind(c)))
      .pipe(takeUntil(this._onRemoved$))
      .subscribe((d: boolean[]) => {
        controls.rest = d;
      });

    // Subscribe to mouse input for camera rotation
    let rotationDelta: Point2 = { x: 0, y: 0 };
    this.mouseInput.delta$.pipe(takeUntil(this._onRemoved$)).subscribe(delta => {
      rotationDelta = Pnt2.add(rotationDelta, delta);
    });

    // Setup updating camera position and rotation based on input
    this.camera.tick$.pipe(takeUntil(this._onRemoved$)).subscribe(() => {
      let translateVector = { x: 0, y: 0, z: 0 };
      const [u, d, zo, zi] = controls.rest;
      if (controls.direction.upDown !== undefined) translateVector.z = controls.direction.upDown ? -1 : 1;
      if (controls.direction.leftRight !== undefined) translateVector.x = controls.direction.leftRight ? -1 : 1;
      if (u != d) translateVector.y = d ? -1 : 1;
      if (zo != zi) this.camera.object3D.fov += zo ? 1 : -1;
      this.camera.position = Pnt3.add(
        this.camera.position,
        Pnt3.rot(Pnt3.scalarMult(Pnt3.norm(translateVector), this.options.movementOptions.speed), this.camera.rotation),
      );
      if (rotationDelta.x != 0 || rotationDelta.y != 0) {
        this.camera.rotation = Qtrn.combineRotations(
          Qtrn.fromAngle({ x: 0, y: 0, z: 1 }, -rotationDelta.x / 300),
          this.camera.rotation,
          Qtrn.fromAngle({ x: 1, y: 0, z: 0 }, -rotationDelta.y / 300),
        );
        rotationDelta = { x: 0, y: 0 };
      }
    });

    // start input
    await this.mouseInput.start();
    await this.directionsInput.start();
  }

  async onRemoved(): Promise<void> {
    await this.mouseInput.stop(true);
    await this.directionsInput.stop();
  }
}
