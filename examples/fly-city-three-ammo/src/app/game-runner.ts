import {
  CharacterController3dEntity,
  createInlineTickController,
  GgCarEntity,
  GroupEntity,
  GgCarHandlingController,
  MapGraph3dEntity,
  MapGraphNodeType,
  Pnt3,
  Point3,
  Qtrn,
  RaycastVehicle3dEntity,
  Renderer3dEntity,
  TickOrder,
  Trigger3dEntity,
} from '@gg-web-engine/core';
import { MobileControls, TouchButton } from '@gg-web-engine/mobile-controls';
import { BehaviorSubject, combineLatest, filter, Observable, pairwise } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { GameCameraController } from './game-camera-controller';
import { GameAudio } from './game-audio';
import { HttpClient } from '@angular/common/http';
import { FlyCityTypeDoc, FlyCityWorld } from './app.component';
import { Multiplayer } from './multiplayer';

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

  public handling?: GgCarHandlingController;
  public readonly gameCameraController: GameCameraController;
  public readonly audio: GameAudio;

  public readonly state$: BehaviorSubject<CurrentState> = new BehaviorSubject<CurrentState>({ mode: 'freecamera' });

  /** The one player character in the world (controlled on foot, or left standing after being released). */
  private characterGroup: GroupEntity | null = null;
  private spawning = false;
  /**
   * Cars taken out of their map tile because somebody drives them (this player, or in multiplayer
   * any other): a tile car unloads together with its tile, a driven one must not. Once nobody
   * drives it, it goes into the tile it stands on.
   */
  private readonly roamingCars = new Set<GgCarEntity>();
  /** Where the driven car was last tick - a removed car can't be asked any more. */
  private drivenCarPosition: Point3 = Pnt3.O;

  get controlCar$(): Observable<GgCarEntity | null> {
    return this.state$.pipe(map(x => x.mode === 'driving' ? x.car : null));
  }

  constructor(
    public readonly http: HttpClient,
    public readonly world: FlyCityWorld,
    public readonly renderer: Renderer3dEntity<FlyCityTypeDoc['vTypeDoc']>,
    public readonly cityMapGraph: MapGraph3dEntity<FlyCityTypeDoc>,
    public readonly mapBounds: Trigger3dEntity<FlyCityTypeDoc['pTypeDoc']>,
    /** set in multiplayer mode */
    public readonly mp: Multiplayer | null = null,
  ) {
    this.gameCameraController = new GameCameraController(this.world, this.renderer);
    if (this.mp) {
      this.setupMultiplayer(this.mp);
    }
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
        } else if (this.mp) {
          // every peer sees the fall; only the owner removes it, for everyone
          const target = entity.parent instanceof GgCarEntity ? entity.parent : entity;
          if (this.mp.net.isNetworked(target) && this.mp.net.isLocallyOwned(target)) {
            this.mp.net.despawn(target);
          }
        } else {
          this.world.removeEntity(entity, true);
        }
      }
    });
    combineLatest(this.gameCameraController.cameraIndex$, this.state$.pipe(pairwise()))
      .subscribe(([index, [oldState, newState]]) => {
        const car: RaycastVehicle3dEntity | undefined = (newState as any).car || (oldState as any).car;
        if (car && car.world) {
          car.visible = newState.mode !== 'driving' || index != 1; // invisible if bumper camera
        }
      });
    this.state$.pipe(pairwise()).subscribe(([oldState, newState]) => {
      const oldCar = oldState.mode === 'driving' ? oldState.car : null;
      const newCar = newState.mode === 'driving' ? newState.car : null;
      if (newCar && oldCar !== newCar) {
        this.takeCar(newCar);
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
      } else if (state.mode === 'driving') {
        this.drivenCarPosition = state.car.position;
      }
      for (const car of this.roamingCars) {
        const driven = (state.mode === 'driving' && state.car === car) || !!this.mp?.net.possessorOf(car);
        if (!driven) {
          this.parkCar(car);
        }
      }
    });
  }

  /** Take a car somebody starts driving out of its tile, so it survives leaving that tile far behind. */
  private roam(car: GgCarEntity) {
    if (this.cityMapGraph.detachFromChunk([car]).length > 0) {
      this.roamingCars.add(car);
    }
  }

  private takeCar(car: GgCarEntity) {
    this.roam(car);
    this.drivenCarPosition = car.position;
    // whatever else removes the car (falling off the map, another peer despawning it): don't keep
    // driving a disposed entity - fly free, then get back on foot where the car was
    car.onRemoved$.pipe(
      takeUntil(this.state$.pipe(filter(s => s.mode !== 'driving' || s.car !== car))),
      takeUntil(this.world.disposed$),
    ).subscribe(() => {
      this.state$.next({ mode: 'freecamera' });
      this.spawnAndControl(Pnt3.add(this.drivenCarPosition, { x: 0, y: 0, z: 2 })).then();
    });
  }

  /** A car left behind belongs to the tile it now stands on, and unloads with that one. */
  private parkCar(car: GgCarEntity) {
    if (car.disposed) {
      this.roamingCars.delete(car);
      return;
    }
    if (!car.world) {
      // multiplayer hides a car whose driver is out of view - it is parked once it shows up again
      return;
    }
    this.roamingCars.delete(car);
    let nearest: MapGraphNodeType | null = null;
    let distance = Infinity;
    for (const node of this.cityMapGraph.loaded.keys()) {
      const curDistance = Pnt3.len(Pnt3.sub(node.position, car.position));
      if (curDistance < distance) {
        distance = curDistance;
        nearest = node;
      }
    }
    if (nearest) {
      this.cityMapGraph.attachToChunk(nearest, [car]);
    }
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
    // names are network ids: each peer's character needs its own
    const name = this.mp ? `Player_${this.mp.net.localPeerId}` : 'Player';
    const group = await this.world.loader.loadLevel({
      entities: [{
        class: 'Player',
        name,
        position,
        config: {
          radius: 0.4,
          centersDistance: 1.0,
          display: { model: { path: PLAYER_MODEL_PATH } },
        },
      }],
    }, 'PlayerGroup');
    this.characterGroup = group;
    const character = group.getChildEntityByName<CharacterController3dEntity<FlyCityTypeDoc>>(name);
    // a runtime spawn: it appears on every peer; possessing it makes this peer drive it
    this.mp?.net.possess(character);
    return character;
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
      if (entity instanceof GgCarEntity && !this.mp?.isPossessedByOther(entity)) {
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
    if (!car.world) {
      // the car is gone (e.g. its tile unloaded) - nothing to walk to any more
      character.moveDirection = Pnt3.O;
      this.state$.next({ mode: 'onfoot', character });
      return;
    }
    if (Pnt3.len(flat) <= ENTER_CAR_ARRIVE_DISTANCE) {
      character.moveDirection = Pnt3.O;
      if (this.mp && !this.mp.net.possess(car)) {
        // somebody else got in first
        this.state$.next({ mode: 'onfoot', character });
        return;
      }
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
    this.mp?.net.release(car);
    await this.spawnAndControl(this.driverSeatSpot(car));
  }

  private setupMultiplayer(mp: Multiplayer) {
    // where this player "is" for ownership arbitration; a free-flying spectator holds nothing
    mp.net.localPosition = () => {
      const state = this.state$.getValue();
      switch (state.mode) {
        case 'freecamera':
          return null;
        case 'driving':
          return state.car.position;
        default:
          return state.character.position;
      }
    };
    mp.net.possessionChanged$.subscribe(({ entity, to }) => {
      if (entity instanceof GgCarEntity && to !== null && to !== mp.net.localPeerId) {
        // another player's ride: this peer's tiles must not unload it under them either
        this.roam(entity);
      }
      const state = this.state$.getValue();
      if (state.mode === 'driving' && state.car === entity && to !== null && to !== mp.net.localPeerId) {
        // lost a race for the driver's seat - step out
        this.spawnAndControl(this.driverSeatSpot(state.car)).then();
      }
    });
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
    this.handling = new GgCarHandlingController(this.world.keyboardInput, null!, {
      keymap: 'wasd+arrows',
      gearUpDownKeys: ['CapsLock', 'ShiftLeft'],
      handbrakeKey: 'Space',
      maxSteerDeltaPerSecond: 12,
      // the throttle keys pick the direction themselves: "down" brakes, and reverses once the car
      // stands still - no neutral, no shifting by hand
      autoReverse: true,
      neutralGear: false,
    });
    this.handling.switchingGearsEnabled = false;
    this.handling.active = false;
    this.world.addEntity(this.handling);
    // On phones and tablets: the car, on-foot and free-camera controls come with the controllers
    // themselves; every key of the game's own gets a button, shown in the modes where it does
    // something and packed into a row from the right
    const mobileControls = new MobileControls();
    const keyButtons: [button: TouchButton, modes: CurrentState['mode'][] | 'always'][] = [
      ['F', 'Enter or leave a car', ['onfoot', 'entering', 'driving']],
      ['G', 'Spawn a character / back to fly mode', ['freecamera', 'onfoot']],
      ['R', 'Reset car', ['driving']],
      ['H', 'Honk', ['driving']],
      ['C', 'Next car camera / camera FOV', ['driving', 'freecamera']],
      ['Z', 'Camera FOV', ['freecamera']],
      ['X', 'Toggle help', 'always'],
      ['P', 'Pause', 'always'],
      ['L', 'Reload level', 'always'],
    ].map(([key, label, modes]) => [
      new TouchButton({
        id: `key-${(key as string).toLowerCase()}`,
        label: label as string,
        content: key as string,
        placement: { top: 12, width: 6, height: 6 },
      }).bindKey(this.world.keyboardInput, `Key${key}`),
      modes as CurrentState['mode'][] | 'always',
    ]);
    mobileControls.addControls(...keyButtons.map(([button]) => button));
    this.state$.subscribe(state => {
      let slot = 0;
      for (const [button, modes] of keyButtons) {
        button.visible = modes === 'always' || modes.includes(state.mode);
        if (button.visible) {
          button.place({ right: 4 + 7.5 * slot++ });
        }
      }
    });
    this.world.addEntity(mobileControls);
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
