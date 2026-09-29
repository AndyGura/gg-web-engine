import {
  CharacterController3dEntity,
  createInlineTickController,
  GgCarEntity,
  GroupEntity,
  GgCarKeyboardHandlingController,
  MapGraph3dEntity,
  Pnt3,
  Point3,
  Qtrn,
  RaycastVehicle3dEntity,
  Renderer3dEntity,
  TickOrder,
  Trigger3dEntity,
} from '@gg-web-engine/core';
import { BehaviorSubject, combineLatest, filter, Observable, pairwise } from 'rxjs';
import { map } from 'rxjs/operators';
import { GameCameraController } from './game-camera-controller';
import { GameAudio } from './game-audio';
import { HttpClient } from '@angular/common/http';
import { FlyCityTypeDoc, FlyCityWorld } from './app.component';

// Blockman is shared with the player-character examples (source: examples/assets/characters).
const PLAYER_MODEL_PATH = '/assets/characters/blockman';
const ENTER_CAR_MAX_DISTANCE = 6;
// How close the character needs to walk to the driver's seat spot before actually entering the car.
const ENTER_CAR_ARRIVE_DISTANCE = 0.3;

type CarType = 'lambo' | 'truck' | 'car';

export type CurrentState =
  { mode: 'freecamera' }
  | { mode: 'onfoot', character: CharacterController3dEntity<FlyCityTypeDoc> }
  // walking (no player control) towards the driver's seat, on the way to 'driving'
  | { mode: 'entering', character: CharacterController3dEntity<FlyCityTypeDoc>, car: GgCarEntity, carType: CarType, target: Point3 }
  | { mode: 'driving', car: GgCarEntity, carType: CarType };

export class GameRunner {

  public handling?: GgCarKeyboardHandlingController;
  public readonly gameCameraController: GameCameraController;
  public readonly audio: GameAudio;

  public readonly state$: BehaviorSubject<CurrentState> = new BehaviorSubject<CurrentState>({ mode: 'freecamera' });

  /** The one player character in the world (controlled on foot, or left standing after being released). */
  private characterGroup: GroupEntity | null = null;
  private spawning = false;

  get controlCar$(): Observable<GgCarEntity | null> {
    return this.state$.pipe(map(x => x.mode === 'driving' ? x.car : null));
  }

  constructor(
    public readonly http: HttpClient,
    public readonly world: FlyCityWorld,
    public readonly renderer: Renderer3dEntity<FlyCityTypeDoc['vTypeDoc']>,
    public readonly cityMapGraph: MapGraph3dEntity<FlyCityTypeDoc>,
    public readonly mapBounds: Trigger3dEntity<FlyCityTypeDoc['pTypeDoc']>,
  ) {
    this.gameCameraController = new GameCameraController(this.world, this.renderer);
    this.state$.subscribe((state) => {
      this.gameCameraController.state = state;
      if (this.handling) {
        if (state.mode === 'driving') {
          this.handling.car = state.car;
          this.handling.active = true;
        } else {
          this.handling.active = false;
        }
      }
    });
    this.mapBounds.onEntityLeft.subscribe((entity) => {
      if (entity) {
        const state = this.state$.getValue();
        if (state.mode === 'driving' && state.car.raycastVehicle === entity) {
          this.resetMyCar();
        } else if ((state.mode === 'onfoot' || state.mode === 'entering') && state.character === entity) {
          // fell off the map (e.g. spawned/walked over a gap) - reset position instead of leaving
          // it disposed with the game stuck in onfoot/entering mode pointing at a dead entity
          this.resetMyCharacter(state.character);
        } else {
          this.world.removeEntity(entity, true);
        }
      }
    });
    combineLatest(this.gameCameraController.cameraIndex$, this.state$.pipe(pairwise()))
      .subscribe(([index, [oldState, newState]]) => {
        const car: RaycastVehicle3dEntity | undefined = (newState as any).car || (oldState as any).car;
        if (car) {
          car.visible = newState.mode !== 'driving' || index != 1; // invisible if bumper camera
        }
      });
    this.audio = new GameAudio(
      this.http,
      this.world,
      this.state$.asObservable(),
    );
    // drives the character straight towards the car while 'entering' - runs before the character's
    // own movement tick (TickOrder.PHYSICS_SIMULATION - 5) so the moveDirection/rotation it sets
    // this tick are the ones actually applied this tick
    createInlineTickController(this.world, TickOrder.PHYSICS_SIMULATION - 10, 'EnterCarWalker').subscribe(() => {
      const state = this.state$.getValue();
      if (state.mode === 'entering') {
        this.updateEnteringCar(state);
      }
    });
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

  private resetMyCharacter(character: CharacterController3dEntity<FlyCityTypeDoc>) {
    const nearest = this.cityMapGraph.nearestDummy;
    // a couple meters above the tile's own position, same as every other character spawn point in
    // this file, so it drops safely onto the ground rather than potentially spawning inside it
    const spawnPosition = Pnt3.add(nearest ? nearest.data.position : Pnt3.O, { x: 0, y: 0, z: 2 });
    character.position = spawnPosition;
    character.fallVelocity = Pnt3.O;
    character.airHorizontalVelocity = Pnt3.O;
  }

  private async spawnCharacter(position: Point3): Promise<CharacterController3dEntity<FlyCityTypeDoc>> {
    this.removeCharacter();
    // loadLevel builds the "Player" entity (capsule body + animated model) and adds it to the world
    // inside a group entity, which is what we later remove to get rid of the character.
    const group = await this.world.loader.loadLevel({
      entities: [{
        class: 'Player',
        name: 'Player',
        position,
        config: {
          radius: 0.4,
          centersDistance: 1.0,
          display: { model: { path: PLAYER_MODEL_PATH } },
        },
      }],
    }, 'PlayerGroup');
    this.characterGroup = group;
    return group.getChildEntityByName<CharacterController3dEntity<FlyCityTypeDoc>>('Player');
  }

  private removeCharacter() {
    if (this.characterGroup) {
      this.world.removeEntity(this.characterGroup, true);
      this.characterGroup = null;
    }
  }

  private findNearestCar(from: Point3, maxDistance = Number.MAX_SAFE_INTEGER): GgCarEntity | null {
    let distance = maxDistance;
    let car: GgCarEntity | null = null;
    for (const entity of this.world.children) {
      if (entity instanceof GgCarEntity) {
        const curDistance = Pnt3.len(Pnt3.sub(from, entity.position));
        if (curDistance < distance) {
          distance = curDistance;
          car = entity;
        }
      }
    }
    return car;
  }

  private carType(car: GgCarEntity): CarType {
    return car.name.startsWith('lambo') ? 'lambo' : (car.name.startsWith('truck') ? 'truck' : 'car');
  }

  // spot next to the driver's side, slightly above the ground so the character drops onto it -
  // shared by the "walk up to the car" (entering) and "step out of the car" (leaving) spawn points
  private driverSeatSpot(car: GgCarEntity): Point3 {
    return Pnt3.add(car.position, Pnt3.rot({ x: -2.5, y: 0, z: 1 }, car.rotation));
  }

  private startEnteringCar(character: CharacterController3dEntity<FlyCityTypeDoc>, car: GgCarEntity) {
    this.state$.next({
      mode: 'entering',
      character,
      car,
      carType: this.carType(car),
      target: this.driverSeatSpot(car),
    });
  }

  private updateEnteringCar(state: Extract<CurrentState, { mode: 'entering' }>) {
    const { character, car, carType, target } = state;
    const toTarget = Pnt3.sub(target, character.position);
    const flat: Point3 = { x: toTarget.x, y: toTarget.y, z: 0 };
    if (Pnt3.len(flat) <= ENTER_CAR_ARRIVE_DISTANCE) {
      character.moveDirection = Pnt3.O;
      this.removeCharacter(); // "entering" is just the character disappearing, no animation
      this.state$.next({ mode: 'driving', car, carType });
      return;
    }
    // face the target and walk straight at it - no pathfinding, just a direct line
    const theta = Pnt3.toSpherical(flat).theta;
    character.rotation = Qtrn.fromAngle(Pnt3.Z, theta - Math.PI / 2);
    character.moveDirection = { x: 0, y: 1, z: 0 };
  }

  private async leaveCar(car: GgCarEntity) {
    await this.spawnAndControl(this.driverSeatSpot(car));
  }

  private async spawnInFrontOfCamera() {
    const forward = Pnt3.rot({ x: 0, y: 0, z: -1 }, this.renderer.rotation);
    await this.spawnAndControl(Pnt3.add(this.renderer.position, Pnt3.scalarMult(forward, 4)));
  }

  private async spawnAndControl(position: Point3) {
    if (this.spawning) {
      return; // model is still loading from a previous key press
    }
    this.spawning = true;
    try {
      const character = await this.spawnCharacter(position);
      this.state$.next({ mode: 'onfoot', character });
    } finally {
      this.spawning = false;
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
      filter(x => !!x && this.state$.getValue().mode === 'driving'),
    ).subscribe(() => {
      if (this.gameCameraController.cameraIndex$.getValue() >= this.gameCameraController.cameraMotionFactory.length - 1) {
        this.gameCameraController.cameraIndex$.next(0);
      } else {
        this.gameCameraController.cameraIndex$.next(this.gameCameraController.cameraIndex$.getValue() + 1);
      }
    });
    this.world.keyboardInput.bind('KeyF').pipe(filter(x => x)).subscribe(() => {
      const state = this.state$.getValue();
      if (state.mode === 'onfoot') {
        const car = this.findNearestCar(state.character.position, ENTER_CAR_MAX_DISTANCE);
        if (car) {
          this.startEnteringCar(state.character, car);
        }
      } else if (state.mode === 'entering') {
        // cancel walking to the car, hand control back to the player right where it's standing
        state.character.moveDirection = Pnt3.O;
        this.state$.next({ mode: 'onfoot', character: state.character });
      } else if (state.mode === 'driving') {
        this.leaveCar(state.car).then();
      }
    });

    this.world.keyboardInput.bind('KeyG').pipe(filter(x => x)).subscribe(() => {
      const state = this.state$.getValue();
      if (state.mode === 'freecamera') {
        this.spawnInFrontOfCamera().then();
      } else if (state.mode === 'onfoot') {
        this.state$.next({ mode: 'freecamera' }); // the character stays where it is
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
