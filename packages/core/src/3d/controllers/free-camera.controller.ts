import { IController } from '../../base/controllers/i-controller';
import { combineLatest, Subject, takeUntil } from 'rxjs';
import { MouseController, MouseControllerOptions } from '../../base/controllers/mouse.controller';
import { Pnt3 } from '../../base/math/point3';
import { Gg3dCameraEntity } from '../entities/gg-3d-camera.entity';
import { KeyboardController } from '../../base/controllers/keyboard.controller';
import { Pnt2 } from '../../base/math/point2';
import { Point2 } from '../../base/models/points';
import { Qtrn } from '../../base/math/quaternion';
import { bindDirectionKeys, DirectionKeymap, DirectionOutput } from '../../base/controllers/common';

type FreeCameraControllerOptions = {
  keymap: DirectionKeymap;
  movementOptions: {
    speed: number;
  };
  mouseOptions: MouseControllerOptions;
};

export class FreeCameraController implements IController {
  private readonly mController: MouseController;
  private readonly stop$: Subject<void> = new Subject<void>();

  constructor(
    private readonly keyboardController: KeyboardController,
    private readonly camera: Gg3dCameraEntity,
    private readonly options: FreeCameraControllerOptions = {
      keymap: 'wasd',
      movementOptions: { speed: 0.5 },
      mouseOptions: {},
    },
  ) {
    this.mController = new MouseController(options.mouseOptions);
  }

  async start(): Promise<void> {
    let controls: { direction: DirectionOutput; rest: boolean[] } = { direction: {}, rest: [] };
    const keys = ['KeyE', 'KeyQ'];
    if (this.camera.object3D.supportsFov) {
      keys.push('KeyZ', 'KeyC');
    }
    bindDirectionKeys(this.keyboardController, this.options.keymap)
      .pipe(takeUntil(this.stop$))
      .subscribe(d => {
        controls.direction = d;
      });
    combineLatest(keys.map(c => this.keyboardController.bind(c)))
      .pipe(takeUntil(this.stop$))
      .subscribe((d: boolean[]) => {
        controls.rest = d;
      });

    let rotationDelta: Point2 = { x: 0, y: 0 };
    this.mController.delta$.pipe(takeUntil(this.stop$)).subscribe(delta => {
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

    await this.mController.start();
  }

  async stop(unlockPointer: boolean = true): Promise<void> {
    this.stop$.next();
    await this.mController.stop(unlockPointer);
  }
}
