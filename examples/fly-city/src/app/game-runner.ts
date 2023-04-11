import {
  CarKeyboardHandlingController,
  Gg3dMapGraphEntity,
  Gg3dRaycastVehicleEntity,
  Gg3dRenderer,
  Gg3dTriggerEntity,
  Gg3dWorld,
  Pnt3,
} from '@gg-web-engine/core';
import { Gg3dVisualScene } from '@gg-web-engine/three';
import { Gg3dPhysicsWorld } from '@gg-web-engine/ammo';
import { BehaviorSubject, combineLatest, filter, Observable, pairwise } from 'rxjs';
import { map } from 'rxjs/operators';
import { GameCameraController } from './game-camera-controller';
import { GameAudio } from './game-audio';
import { HttpClient } from '@angular/common/http';

export type CurrentState =
  { mode: 'freecamera' }
  | { mode: 'driving', car: Gg3dRaycastVehicleEntity, carType: 'lambo' | 'truck' | 'car' };

export class GameRunner {

  public handling?: CarKeyboardHandlingController;
  public readonly gameCameraController: GameCameraController;
  public readonly audio: GameAudio;

  public readonly state$: BehaviorSubject<CurrentState> = new BehaviorSubject<CurrentState>({ mode: 'freecamera' });

  get controlCar$(): Observable<Gg3dRaycastVehicleEntity | null> {
    return this.state$.pipe(map(x => x.mode === 'driving' ? x.car : null));
  }

  constructor(
    public readonly http: HttpClient,
    public readonly world: Gg3dWorld<Gg3dVisualScene, Gg3dPhysicsWorld>,
    public readonly renderer: Gg3dRenderer,
    public readonly cityMapGraph: Gg3dMapGraphEntity,
    public readonly mapBounds: Gg3dTriggerEntity,
  ) {
    this.gameCameraController = new GameCameraController(this.world, this.renderer);
    this.state$.subscribe((state) => {
      this.gameCameraController.state = state;
      if (this.handling) {
        if (state.mode === 'freecamera') {
          this.handling.active = false;
        } else if (state.mode === 'driving') {
          this.handling.car = state.car;
          this.handling.active = true;
        }
      }
    });
    this.mapBounds.onEntityLeft.subscribe((entity) => {
      if (entity) {
        const state = this.state$.getValue();
        if (state.mode === 'driving' && state.car === entity) {
          this.resetMyCar();
        } else {
          this.world.removeEntity(entity, true);
        }
      }
    });
    combineLatest(this.gameCameraController.cameraIndex$, this.state$.pipe(pairwise()))
      .subscribe(([index, [oldState, newState]]) => {
        const car: Gg3dRaycastVehicleEntity | undefined = (newState as any).car || (oldState as any).car;
        if (car) {
          car.visible = newState.mode == 'freecamera' || index != 1; // invisible if bumper camera
        }
      });
    this.audio = new GameAudio(
      this.http,
      this.state$.asObservable(),
    );
  }

  public resetMyCar() {
    const state = this.state$.getValue();
    if (state.mode !== 'driving') {
      return;
    }
    const nearest = this.cityMapGraph.nearestDummy;
    if (nearest) {
      state.car.resetTo({ position: nearest.data.position, rotation: { x: 0, y: 0, z: 0, w: 1 } });
      this.gameCameraController.carCameraController.animationFunction = this.gameCameraController.cameraMotionFactory[this.gameCameraController.cameraIndex$.getValue()][0](state.car, state.carType); // reset elastic camera
    }
  }

  public setupKeyBindings() {
    this.handling = new CarKeyboardHandlingController(this.world.keyboardInput, null!, {
      keymap: 'wasd+arrows',
      gearUpDownKeys: ['CapsLock', 'ShiftLeft'],
    });
    this.handling.active = false;
    this.world.addEntity(this.handling);
    this.world.keyboardInput.bind('KeyC').pipe(
      filter(x => !!x && this.state$.getValue().mode != 'freecamera'),
    ).subscribe(() => {
      if (this.gameCameraController.cameraIndex$.getValue() >= this.gameCameraController.cameraMotionFactory.length - 1) {
        this.gameCameraController.cameraIndex$.next(0);
      } else {
        this.gameCameraController.cameraIndex$.next(this.gameCameraController.cameraIndex$.getValue() + 1);
      }
    });
    this.world.keyboardInput.bind('KeyF').pipe(filter(x => x)).subscribe(() => {
      if (this.state$.getValue().mode === 'freecamera') {
        let distance = Number.MAX_SAFE_INTEGER;
        let car: Gg3dRaycastVehicleEntity | null = null;
        for (const entity of this.world.children) {
          if (entity instanceof Gg3dRaycastVehicleEntity) {
            const curDistance = Pnt3.len(Pnt3.sub(this.renderer.camera.position, entity.position));
            if (curDistance < distance) {
              distance = curDistance;
              car = entity;
            }
          }
        }
        if (car) {
          this.state$.next({
            mode: 'driving',
            car,
            carType: car.name.startsWith('lambo') ? 'lambo' : (car.name.startsWith('truck') ? 'truck' : 'car'),
          });
        }
      } else {
        this.state$.next({ mode: 'freecamera' });
      }
    });

    this.world.keyboardInput.bind('KeyR')
      .pipe(filter(x => x))
      .subscribe(() => this.resetMyCar());

    combineLatest(
      this.state$.pipe(map(s => s.mode === 'driving')),
      this.world.keyboardInput.bind('KeyH'),
    )
      .pipe(map(([a, b]) => a && b))
      .subscribe((honk) => {
        this.audio.honk = honk;
      });
  }

  stopGame() {
    this.world.dispose();
    this.audio.disposeAudio();
  }


}
