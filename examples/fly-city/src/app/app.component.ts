import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {
  CubeReflectionMapping,
  CubeTexture,
  CubeTextureLoader,
  DirectionalLight,
  PerspectiveCamera,
  RGBAFormat
} from 'three';
import { Howl } from 'howler';
import {
  CachingStrategy,
  CarKeyboardController,
  EntityMotionController,
  FreeCameraController,
  Gg3dMapGraphEntity,
  Gg3dRaycastVehicleEntity,
  Gg3dTriggerEntity,
  Gg3dWorld,
  GgDummy,
  GgViewportManager,
  IGg3dBody,
  IGg3dObject,
  lerpNumber,
  MapGraph,
  MotionControlFunction,
  Pnt3,
  Qtrn,
} from '@gg-web-engine/core';
import { Gg3dVisualScene, GgRenderer, ThreeCamera, ThreeCameraEntity } from '@gg-web-engine/three';
import { Gg3dBody, Gg3dPhysicsWorld, Gg3dRaycastVehicle } from '@gg-web-engine/ammo';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  first,
  NEVER,
  Observable,
  of,
  pairwise,
  skip,
  switchMap
} from 'rxjs';
import { map } from 'rxjs/operators';
import { bumperCamera, farCamera, nearCamera } from './car-cameras';
import { HttpClient } from '@angular/common/http';

type CurrentState =
  { mode: 'freecamera' }
  | { mode: 'driving', car: Gg3dRaycastVehicleEntity, carType: 'lambo' | 'truck' | 'car' };

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  title = 'fly-city';

  @ViewChild('stage') stage!: ElementRef<HTMLCanvasElement>;

  world!: Gg3dWorld;

  state$: BehaviorSubject<CurrentState> = new BehaviorSubject<CurrentState>({ mode: 'freecamera' });

  cameraMotionFactory: [(car: Gg3dRaycastVehicleEntity, type: 'lambo' | 'truck' | 'car') => MotionControlFunction, number, (t: number) => number][] = [
    [farCamera, 600, (t: number) => Math.pow(t, 0.3)],
    [bumperCamera, 250, (t: number) => 0.7 * Math.pow(t, 0.3)],
    [nearCamera, 250, (t: number) => 0.7 + 0.3 * Math.pow(t, 0.3)],
  ];

  cameraIndex$: BehaviorSubject<number> = new BehaviorSubject<number>(0);

  get controlCar$(): Observable<Gg3dRaycastVehicleEntity | null> {
    return this.state$.pipe(map(x => x.mode === 'driving' ? x.car : null));
  }

  constructor(
    private readonly http: HttpClient,
  ) {
  }

  async ngOnInit(): Promise<void> {
    // TODO refactor this mess

    const scene: Gg3dVisualScene = new Gg3dVisualScene();
    const physScene: Gg3dPhysicsWorld = new Gg3dPhysicsWorld();
    this.world = new Gg3dWorld(scene, physScene, true);
    await this.world.init();

    const canvas = await GgViewportManager.instance.createCanvas(1);
    const renderer: GgRenderer = new GgRenderer(canvas, {}, new ThreeCameraEntity(
      new ThreeCamera(new PerspectiveCamera(75, 1, 1, 10000))
    ));
    this.world.addEntity(renderer);
    renderer.camera.position = { x: 0, y: -15, z: 10 };
    renderer.camera.rotation = Qtrn.lookAt(
      renderer.camera.position,
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
    );
    renderer.activate();

    const sun = new DirectionalLight(0xffffff, 3);
    sun.position.set(200, 150, 120);
    scene.nativeScene?.add(sun);
    const sky = new DirectionalLight(0xaaaaff, 0.4);
    sky.position.set(-200, -150, 20);
    scene.nativeScene?.add(sky);

    const envMap: CubeTexture = new CubeTextureLoader()
      .setPath(`assets/`)
      .load([
        'sky_nx.png', 'sky_px.png',
        'sky_py.png', 'sky_ny.png',
        'sky_pz.png', 'sky_nz.png'
      ]);
    envMap.format = RGBAFormat;
    envMap.mapping = CubeReflectionMapping;
    scene.nativeScene!.background = envMap;

    const mapGraph = MapGraph.fromSquareGrid(
      Array(10).fill(null).map((_, i) => (
        Array(10).fill(null).map((_, j) => ({
          path: 'assets/city_tile',
          position: { x: (j - 5) * 75, y: (i - 5) * 75, z: 0 },
          loadOptions: {
            cachingStrategy: CachingStrategy.Entities,
          },
        }))
      ))
    );
    const cityMapGraph = new Gg3dMapGraphEntity(mapGraph, { loadDepth: 3 });
    cityMapGraph.loaderCursorEntity$.next(renderer.camera);
    cityMapGraph.chunkLoaded$.subscribe(async ([{ meta }, { position }]) => {
      // spawn cars
      const cars =
        await Promise.all(meta.dummies
          .filter(x => x.is_car && (Math.random() < (x.spawn_probability || 1) / 3))
          .map(async dummy => {
            const [
              {
                resources: [{ object3D: chassisMesh, body: chassisBody }],
                meta: { dummies: chassisDummies }
              },
              { resources: [{ object3D: wheelMesh }] },
              specs,
            ] = await Promise.all([
              // TODO use caching strategy "Entities" after cloned Ammo.js object mass will be fixed
              this.world.loader.loadGgGlbResources('assets/' + dummy.car_id, CachingStrategy.Files),
              this.world.loader.loadGgGlbResources('assets/' + (dummy.car_id.startsWith('truck') ? 'truck_wheel' : 'wheel'), CachingStrategy.Files),
              fetch(`assets/${dummy.car_id.startsWith('truck') ? 'truck' : 'car'}_specs.json`).then(r => r.text()).then(r => JSON.parse(r))
            ]);
            const entity = this.generateCar(physScene, chassisMesh, chassisBody, chassisDummies, wheelMesh, specs);
            entity.name = dummy.car_id;
            entity.position = Pnt3.add(position, dummy.position);
            entity.rotation = dummy.rotation;
            return entity;
          }),
        );
      for (const car of cars) {
        this.world.addEntity(car);
      }
    });
    this.world.addEntity(cityMapGraph);

    cityMapGraph.initialLoadComplete$.pipe(filter(x => !!x), first()).subscribe(async () => {
      this.world.start();

      const [
        {
          resources: [{ object3D: chassisMesh, body: chassisBody }],
          meta: { dummies: chassisDummies }
        },
        { resources: [{ object3D: wheelMesh }] },
        specs
      ] = await Promise.all([
          this.world.loader.loadGgGlbResources('assets/lambo/body'),
          this.world.loader.loadGgGlbResources('assets/lambo/wheel'),
          fetch(`assets/lambo/specs.json`).then(r => r.text()).then(r => JSON.parse(r))
        ]
      );
      const lambo = this.generateCar(physScene, chassisMesh, chassisBody, chassisDummies, wheelMesh, specs);
      lambo.name = 'lambo';
      this.world.addEntity(lambo);
      // TODO rename controllers (which are keyboard/mouse related) globally to something else
      const carController = new CarKeyboardController(this.world.keyboardController, lambo, {
        keymap: 'wasd+arrows',
        gearUpDownKeys: ['CapsLock', 'ShiftLeft']
      });
      let carCameraController: EntityMotionController = new EntityMotionController(
        renderer.camera,
        this.cameraMotionFactory[0][0](lambo, 'lambo'),
        (camera, p) => {
          if (p.fov) {
            (camera as ThreeCameraEntity).object3D.fov = p.fov;
          }
        }
      );

      const playingArea = new Gg3dTriggerEntity(this.world.physicsWorld.factory.createTrigger({
        shape: 'BOX',
        dimensions: { x: 1000, y: 1000, z: 200 },
      }));
      playingArea.position = { x: 0, y: 0, z: 90 };
      playingArea.onEntityLeft.subscribe((entity) => {
        if (!entity) {
          return;
        }
        const state = this.state$.getValue();
        if (state.mode === 'driving' && state.car === entity) {
          this.resetCar(cityMapGraph, carCameraController);
        } else {
          this.world.removeEntity(entity, true);
        }
      });
      this.world.addEntity(playingArea);

      this.world.keyboardController.bind('KeyC').pipe(
        filter(x => !!x && this.state$.getValue().mode != 'freecamera')
      ).subscribe(() => {
        if (this.cameraIndex$.getValue() >= this.cameraMotionFactory.length - 1) {
          this.cameraIndex$.next(0);
        } else {
          this.cameraIndex$.next(this.cameraIndex$.getValue() + 1);
        }
      });
      combineLatest(this.cameraIndex$, this.state$.pipe(pairwise()))
        .subscribe(([index, [oldState, newState]]) => {
          const car: Gg3dRaycastVehicleEntity | undefined = (newState as any).car || (oldState as any).car;
          if (car) {
            car.visible = newState.mode == 'freecamera' || index != 1; // invisible if bumper camera
          }
        });
      this.cameraIndex$.pipe(skip(1)).subscribe(index => {
        const state = this.state$.getValue();
        if (state.mode == 'driving') {
          const [funcProto, duration, easing] = this.cameraMotionFactory[index];
          carCameraController.transitControlFunction(
            funcProto(state.car, state.carType),
            duration,
            easing,
            ({ fov: fovA }, { fov: fovB }, t) => ({ fov: lerpNumber(fovA, fovB, t) })
          );
        }
      });

      const freeCameraController: FreeCameraController = new FreeCameraController(
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
              canvas,
            },
          },
        },
      );

      this.state$.subscribe((state) => {
        if (state.mode === 'freecamera') {
          carController.stop();
          try {
            this.world.removeEntity(carCameraController, false);
          } catch {
            //pass
          }
          freeCameraController.start();
        } else if (state.mode === 'driving') {
          freeCameraController.stop(false);
          carController.car = state.car;
          carController.start();
          this.world.addEntity(carCameraController);
          carCameraController.transitFromStaticState(
            {
              position: renderer.camera.position,
              rotation: renderer.camera.rotation,
              customParameters: { fov: renderer.camera.object3D.fov }
            },
            this.cameraMotionFactory[this.cameraIndex$.getValue()][0](state.car, state.carType),
            800,
            t => Math.pow(t, 0.5),
            ({ fov: fovA }, { fov: fovB }, t) => ({ fov: lerpNumber(fovA, fovB, t) }),
          );
        }
      });

      this.world.keyboardController.bind('KeyF').pipe(filter(x => x)).subscribe(() => {
        if (this.state$.getValue().mode === 'freecamera') {
          let distance = Number.MAX_SAFE_INTEGER;
          let car: Gg3dRaycastVehicleEntity | null = null;
          for (const entity of this.world.children) {
            if (entity instanceof Gg3dRaycastVehicleEntity) {
              const curDistance = Pnt3.len(Pnt3.sub(renderer.camera.position, entity.position));
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

      this.world.keyboardController.bind('KeyR').pipe(filter(x => x)).subscribe(() => {
        this.resetCar(cityMapGraph, carCameraController);
      });

      const engineOnMeta: any = await this.http.get(`assets/engine_on.meta.json`).toPromise();
      const engineOnHowl = new Howl({
        src: `assets/engine_on.mp3`,
        loop: true,
        sprite: engineOnMeta.loop_end_time_ms ? {
          __default: [0, engineOnMeta.loop_end_time_ms, false],
          loop: [engineOnMeta.loop_start_time_ms, engineOnMeta.loop_end_time_ms, true]
        } : undefined,
      });

      const engineOffMeta: any = await this.http.get(`assets/engine_off.meta.json`).toPromise();
      const engineOffHowl = new Howl({
        src: `assets/engine_off.mp3`,
        loop: true,
        sprite: engineOffMeta.loop_end_time_ms ? {
          __default: [0, engineOffMeta.loop_end_time_ms, false],
          loop: [engineOffMeta.loop_start_time_ms, engineOffMeta.loop_end_time_ms, true]
        } : undefined,
      });
      const changeGearHowl = new Howl({ src: `assets/gear.mp3` });

      this.state$.pipe(
        switchMap(state => state.mode === 'freecamera' ? NEVER : state.car.gear$.pipe(skip(1))),
      ).subscribe(() => {
        changeGearHowl.play();
      });

      engineOnHowl.rate(0);
      engineOffHowl.rate(0);
      engineOnHowl.volume(0);
      engineOffHowl.volume(0);
      engineOnHowl.play();
      engineOffHowl.play();

      this.state$.pipe(
        switchMap(state => state.mode === 'freecamera' ? of(null) : state.car.acceleration$),
        map((acc: number | null) => acc === null ? null : (acc > 0 ? engineOnHowl : engineOffHowl)),
        distinctUntilChanged(),
      ).subscribe((activeHowl: any) => {
        if (activeHowl) {
          activeHowl.fade(activeHowl.volume(), 0.25, 100);
          const inactiveHowl = (activeHowl == engineOffHowl ? engineOnHowl : engineOffHowl);
          if (inactiveHowl && inactiveHowl.volume() > 0) {
            inactiveHowl.fade(inactiveHowl.volume(), 0, 100);
          }
        } else {
          engineOnHowl.fade(engineOnHowl.volume(), 0, 100);
          engineOffHowl.fade(engineOffHowl.volume(), 0, 100);
        }
      });

      this.state$.pipe(
        switchMap(state => state.mode === 'freecamera' ? NEVER : state.car.engineRpm$.pipe(map(rpm => [state.car, rpm] as [Gg3dRaycastVehicleEntity, number]))),
      ).subscribe(([car, rpm]: [Gg3dRaycastVehicleEntity, number]) => {
        const engineRpmFactor = ((rpm - 800) / car.carProperties.engine.maxRpm) - 0.5;
        engineOnHowl.rate(1 + engineRpmFactor);
        engineOffHowl.rate(1 + engineRpmFactor);
      });
    });
  }

  private resetCar(map: Gg3dMapGraphEntity, carCameraController: EntityMotionController) {
    const state = this.state$.getValue();
    if (state.mode !== 'driving') {
      return;
    }
    const nearest = map.nearestDummy;
    if (nearest) {
      state.car.resetTo({ position: nearest.data.position, rotation: { x: 0, y: 0, z: 0, w: 1 } });
      carCameraController.motionControlFunction = this.cameraMotionFactory[this.cameraIndex$.getValue()][0](state.car, state.carType); // reset elastic camera
    }
  }

  private generateCar(
    physScene: Gg3dPhysicsWorld, chassisMesh: IGg3dObject | null, chassisBody: IGg3dBody | null,
    chassisDummies: GgDummy[], wheelMesh: IGg3dObject | null, specs: any
  ): Gg3dRaycastVehicleEntity {
    return new Gg3dRaycastVehicleEntity(
      {
        wheelOptions: chassisDummies
          .filter(x => x.name.startsWith('wheel_'))
          .map((wheel) => {
            const tyre_width = wheel.tyre_width || 0.4;
            const isLeft = wheel.name.endsWith('l');
            return {
              tyre_radius: wheel.tyre_radius || 0.3,
              tyre_width,
              position: {
                x: wheel.position.x + tyre_width * (isLeft ? -1 : 1),
                y: wheel.position.y,
                z: wheel.position.z
              },
              isFront: wheel.name.startsWith('wheel_f'),
              isLeft,
              frictionSlip: 3,
              rollInfluence: 0.2,
              maxTravel: 0.25,
            }
          }),
        ...specs,
      },
      chassisMesh,
      new Gg3dRaycastVehicle(
        physScene,
        (chassisBody as Gg3dBody).nativeBody,
      ),
      wheelMesh,
      'x',
    );
  }
}
