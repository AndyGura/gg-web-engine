import {
  EntityMotionController,
  FreeCameraController,
  Gg3dRaycastVehicleEntity,
  Gg3dRenderer,
  Gg3dWorld,
  lerpNumber,
  MotionControlFunction,
} from '@gg-web-engine/core';
import { Gg3dVisualScene, GgRenderer, ThreeCameraEntity } from '@gg-web-engine/three';
import { Gg3dPhysicsWorld, } from '@gg-web-engine/ammo';
import { bumperCamera, farCamera, nearCamera } from './car-cameras';
import { BehaviorSubject, skip } from 'rxjs';
import { CurrentState } from './game-runner';

export class GameCameraController {

  public readonly freeCameraController: FreeCameraController;
  public readonly carCameraController: EntityMotionController;
  public readonly cameraIndex$: BehaviorSubject<number> = new BehaviorSubject<number>(0);

  cameraMotionFactory: [(car: Gg3dRaycastVehicleEntity, type: 'lambo' | 'truck' | 'car') => MotionControlFunction, number, (t: number) => number][] = [
    [farCamera, 600, (t: number) => Math.pow(t, 0.3)],
    [bumperCamera, 250, (t: number) => 0.7 * Math.pow(t, 0.3)],
    [nearCamera, 250, (t: number) => 0.7 + 0.3 * Math.pow(t, 0.3)],
  ];

  private state_: CurrentState = { mode: 'freecamera' };

  public set state(state: CurrentState) {
    if (state.mode === 'freecamera') {
      try {
        this.world.removeEntity(this.carCameraController, false);
      } catch {
        //pass
      }
      this.freeCameraController.start();
    } else if (state.mode === 'driving') {
      this.freeCameraController.stop(false);
      this.world.addEntity(this.carCameraController);
      this.carCameraController.transitFromStaticState(
        {
          position: this.renderer.camera.position,
          rotation: this.renderer.camera.rotation,
          customParameters: { fov: this.renderer.camera.object3D.fov }
        },
        this.cameraMotionFactory[this.cameraIndex$.getValue()][0](state.car, state.carType),
        800,
        t => Math.pow(t, 0.5),
        ({ fov: fovA }, { fov: fovB }, t) => ({ fov: lerpNumber(fovA, fovB, t) }),
      );
    }
    this.state_ = state;
  }


  constructor(
    public readonly world: Gg3dWorld<Gg3dVisualScene, Gg3dPhysicsWorld>,
    public readonly renderer: Gg3dRenderer,
  ) {
    this.freeCameraController = new FreeCameraController(
      this.world.keyboardController,
      renderer.camera,
      {
        keymap: 'wasd+arrows',
        movementOptions: {
          speed: 1,
        },
        mouseOptions: {
          pointerLock: {
            ignoreMovementWhenNotLocked: true,
            canvas: (this.renderer as GgRenderer).canvas!,
          },
        },
      },
    );
    this.carCameraController = new EntityMotionController(
      renderer.camera,
      null!,
      (camera, p) => {
        if (p.fov) {
          (camera as ThreeCameraEntity).object3D.fov = p.fov;
        }
      }
    );
    this.cameraIndex$.pipe(skip(1)).subscribe(index => {
      if (this.state_.mode == 'driving') {
        const [funcProto, duration, easing] = this.cameraMotionFactory[index];
        this.carCameraController.transitControlFunction(
          funcProto(this.state_.car, this.state_.carType),
          duration,
          easing,
          ({ fov: fovA }, { fov: fovB }, t) => ({ fov: lerpNumber(fovA, fovB, t) })
        );
      }
    });
  }


}
