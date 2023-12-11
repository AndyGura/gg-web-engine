import {
  GgCarKeyboardHandlingController,
  MapGraph3dEntity,
  RaycastVehicle3dEntity,
  Trigger3dEntity,
  Gg3dWorld,
  Pnt3,
  Qtrn, Renderer3dEntity,
  GgCarEntity
} from '@gg-web-engine/core';
import { ThreeSceneComponent } from '@gg-web-engine/three';
import { AmmoWorldComponent } from '@gg-web-engine/ammo';
import { BehaviorSubject, combineLatest, filter, Observable, pairwise } from 'rxjs';
import { map } from 'rxjs/operators';
import { GameCameraController } from './game-camera-controller';
import { GameAudio } from './game-audio';
import { HttpClient } from '@angular/common/http';

export type CurrentState =
  { mode: 'freecamera' }
  | { mode: 'driving', car: GgCarEntity, carType: 'lambo' | 'truck' | 'car' };

export class GameRunner {

  public handling?: GgCarKeyboardHandlingController;
  public readonly gameCameraController: GameCameraController;
  public readonly audio: GameAudio;

  public readonly state$: BehaviorSubject<CurrentState> = new BehaviorSubject<CurrentState>({ mode: 'freecamera' });

  get controlCar$(): Observable<GgCarEntity | null> {
    return this.state$.pipe(map(x => x.mode === 'driving' ? x.car : null));
  }

  constructor(
    public readonly http: HttpClient,
    public readonly world: Gg3dWorld<ThreeSceneComponent, AmmoWorldComponent>,
    public readonly renderer: Renderer3dEntity,
    public readonly cityMapGraph: MapGraph3dEntity,
    public readonly mapBounds: Trigger3dEntity,
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
        if (state.mode === 'driving' && state.car.raycastVehicle === entity) {
          this.resetMyCar();
        } else {
          this.world.removeEntity(entity, true);
        }
      }
    });
    combineLatest(this.gameCameraController.cameraIndex$, this.state$.pipe(pairwise()))
      .subscribe(([index, [oldState, newState]]) => {
        const car: RaycastVehicle3dEntity | undefined = (newState as any).car || (oldState as any).car;
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
      state.car.resetTo({ position: nearest.data.position, rotation: Qtrn.O });
      this.gameCameraController.carCameraController.animationFunction = this.gameCameraController.cameraMotionFactory[this.gameCameraController.cameraIndex$.getValue()][0](state.car, state.carType); // reset elastic camera
    }
  }

  public setupKeyBindings() {
    this.handling = new GgCarKeyboardHandlingController(this.world.keyboardInput, null!, {
      keymap: 'wasd+arrows',
      gearUpDownKeys: ['CapsLock', 'ShiftLeft'],
      handbrakeKey: 'Space',
      maxSteerDeltaPerSecond: 12,
      autoReverse: false,
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
        let car: GgCarEntity | null = null;
        for (const entity of this.world.children) {
          if (entity instanceof GgCarEntity) {
            const curDistance = Pnt3.len(Pnt3.sub(this.renderer.position, entity.position));
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
