import {
  AnimationFunction,
  Camera3dAnimationArgs,
  Camera3dAnimator,
  FreeCameraController,
  IPositionable3d,
  Pnt3,
  Renderer3dEntity,
} from '@gg-web-engine/core';
import { bumperCamera, farCamera, nearCamera } from './car-cameras';
import { BehaviorSubject, skip } from 'rxjs';
import { CurrentState } from './game-runner';
import { FlyCityVTypeDoc, FlyCityWorld } from './app.component';

export class GameCameraController {

  public readonly freeCameraController: FreeCameraController;
  public readonly carCameraController: Camera3dAnimator;
  public readonly cameraIndex$: BehaviorSubject<number> = new BehaviorSubject<number>(0);

  cameraMotionFactory: [(car: IPositionable3d, type: 'lambo' | 'truck' | 'car') => AnimationFunction<Camera3dAnimationArgs>, number, (t: number) => number][] = [
    [farCamera, 600, (t: number) => Math.pow(t, 0.3)],
    [bumperCamera, 250, (t: number) => 0.7 * Math.pow(t, 0.3)],
    [nearCamera, 250, (t: number) => 0.7 + 0.3 * Math.pow(t, 0.3)],
  ];

  private state_: CurrentState = { mode: 'freecamera' };

  public set state(state: CurrentState) {
    if (state.mode === 'freecamera') {
      this.freeCameraController.active = true;
      this.carCameraController.active = false;
    } else if (state.mode === 'driving') {
      this.freeCameraController.active = false;
      this.carCameraController.active = true;
      this.carCameraController.transitFromStaticState(
        {
          position: this.renderer.position,
          target: Pnt3.add(
            this.renderer.position,
            Pnt3.rot(
              { x: 0, y: 0, z: -Pnt3.len(Pnt3.sub(state.car.position, this.renderer.position)) },
              this.renderer.rotation,
            ),
          ),
          up: Pnt3.rot(Pnt3.Y, this.renderer.rotation),
          fov: this.renderer.camera.fov,
        },
        this.cameraMotionFactory[this.cameraIndex$.getValue()][0](state.car, state.carType),
        800,
        t => Math.pow(t, 0.5),
      );
    }
    this.state_ = state;
  }


  constructor(
    public readonly world: FlyCityWorld,
    public readonly renderer: Renderer3dEntity<FlyCityVTypeDoc>,
  ) {
    this.freeCameraController = new FreeCameraController(
      this.world.keyboardInput,
      renderer,
      {
        keymap: 'wasd+arrows',
        cameraLinearSpeed: 40,
        ignoreKeyboardUnlessPointerLocked: true,
        ignoreMouseUnlessPointerLocked: true,
        mouseOptions: {
          canvas: this.renderer.renderer.canvas!,
          pointerLock: true,
        },
      },
    );
    this.freeCameraController.active = false;
    this.world.addEntity(this.freeCameraController);
    this.carCameraController = new Camera3dAnimator(renderer, null!);
    this.carCameraController.active = false;
    this.world.addEntity(this.carCameraController);
    this.cameraIndex$.pipe(skip(1)).subscribe(index => {
      if (this.state_.mode == 'driving') {
        const [funcProto, duration, easing] = this.cameraMotionFactory[index];
        this.carCameraController.transitAnimationFunction(
          funcProto(this.state_.car, this.state_.carType),
          duration,
          easing,
        );
      }
    });
  }


}
