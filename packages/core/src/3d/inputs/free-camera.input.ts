import { Input } from '../../base/inputs/input';
import { combineLatest, takeUntil } from 'rxjs';
import { MouseControllerOptions, MouseInput } from '../../base/inputs/mouse.input';
import { Pnt3 } from '../../base/math/point3';
import { Gg3dCameraEntity } from '../entities/gg-3d-camera.entity';
import { KeyboardInput } from '../../base/inputs/keyboard.input';
import { Pnt2 } from '../../base/math/point2';
import { Point2 } from '../../base/models/points';
import { Qtrn } from '../../base/math/quaternion';
import {
  DirectionKeyboardInput,
  DirectionKeyboardKeymap,
  DirectionKeyboardOutput,
} from '../../base/inputs/direction.keyboard-input';

export type FreeCameraControllerOptions = {
  keymap: DirectionKeyboardKeymap;
  movementOptions: {
    speed: number;
  };
  mouseOptions: MouseControllerOptions;
};

export class FreeCameraInput extends Input<[], [unlockPointer?: boolean]> {
  protected readonly mouseInput: MouseInput;
  protected readonly directionsInput: DirectionKeyboardInput;

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

  protected async startInternal(): Promise<void> {
    let controls: { direction: DirectionKeyboardOutput; rest: boolean[] } = { direction: {}, rest: [] };
    const keys = ['KeyE', 'KeyQ'];
    if (this.camera.object3D.supportsFov) {
      keys.push('KeyZ', 'KeyC');
    }
    this.directionsInput.output$
      .pipe(takeUntil(this.stop$))
      .subscribe(d => {
        controls.direction = d;
      });
    combineLatest(keys.map(c => this.keyboard.bind(c)))
      .pipe(takeUntil(this.stop$))
      .subscribe((d: boolean[]) => {
        controls.rest = d;
      });

    let rotationDelta: Point2 = { x: 0, y: 0 };
    this.mouseInput.delta$.pipe(takeUntil(this.stop$)).subscribe(delta => {
      rotationDelta = Pnt2.add(rotationDelta, delta);
    });

    this.camera.tick$.pipe(takeUntil(this.stop$)).subscribe(() => {
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
    await this.mouseInput.start();
    await this.directionsInput.start();
  }

  protected async stopInternal(unlockPointer: boolean = true): Promise<void> {
    await this.mouseInput.stop(unlockPointer);
    await this.directionsInput.stop();
  }
}
