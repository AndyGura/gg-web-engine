import { IController } from './base/i-controller';
import { combineLatest, Subject, takeUntil } from 'rxjs';
import { MouseController, MouseControllerOptions } from './base/mouse.controller';
import { Pnt3 } from '../math/point3';
import { Gg3dCameraEntity } from '../../3d/entities/gg-3d-camera.entity';
import { KeyboardController } from './base/keyboard.controller';
import { Pnt2 } from '../math/point2';
import { Point2 } from '../models/points';
import { Qtrn } from '../math/quaternion';

export class FreeCameraController implements IController {
  private readonly mController: MouseController;
  private readonly stop$: Subject<void> = new Subject<void>();

  constructor(
    private readonly keyboardController: KeyboardController,
    private readonly camera: Gg3dCameraEntity,
    private readonly mouseOptions: MouseControllerOptions = {},
  ) {
    this.mController = new MouseController(mouseOptions);
  }

  async start(): Promise<void> {
    const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ'];
    if (this.camera.object3D.supportsFov) {
      keys.push('KeyZ', 'KeyC');
    }

    let moveDirection: boolean[] = [];
    combineLatest(keys.map(c => this.keyboardController.bind(c)))
      .pipe(takeUntil(this.stop$))
      .subscribe((d: boolean[]) => {
        moveDirection = d;
      });

    let rotationDelta: Point2 = { x: 0, y: 0 };
    this.mController.delta$
      .pipe(takeUntil(this.stop$))
      .subscribe(delta => {
        rotationDelta = Pnt2.add(rotationDelta, delta);
      });

    this.camera.tick$
      .pipe(takeUntil(this.stop$))
      .subscribe(() => {
        if (moveDirection.includes(true)) {
          const [f, l, b, r, u, d, zo, zi] = moveDirection;
          let translateVector = { x: 0, y: 0, z: 0 };
          if (f != b) translateVector.z = f ? -1 : 1;
          if (l != r) translateVector.x = l ? -1 : 1;
          if (u != d) translateVector.y = d ? -1 : 1;
          this.camera.position = Pnt3.add(
            this.camera.position,
            Pnt3.rot(
              Pnt3.scalarMult(Pnt3.norm(translateVector), 0.5),
              this.camera.rotation
            )
          );
          if (zo != zi) this.camera.object3D.fov += zo ? 1 : -1;
        }
        if (rotationDelta.x != 0 || rotationDelta.y != 0) {
          this.camera.rotation = Qtrn.combineRotations(
            Qtrn.fromAngle({ x: 0, y: 0, z: 1}, -rotationDelta.x / 300),
            this.camera.rotation,
            Qtrn.fromAngle({ x: 1, y: 0, z: 0}, -rotationDelta.y / 300)
          );
          rotationDelta = { x: 0, y: 0 };
        }
      });

    await this.mController.start();
  }

  async stop(): Promise<void> {
    this.stop$.next();
    await this.mController.stop();
  }
}
