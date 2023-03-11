import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {
  CubeReflectionMapping,
  CubeTexture,
  CubeTextureLoader,
  DirectionalLight,
  PerspectiveCamera,
  RGBAFormat
} from 'three';
import {
  CarKeyboardController,
  EntityMotionController,
  FreeCameraController,
  Gg3dMapGraphEntity,
  Gg3dRaycastVehicleEntity,
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
  Gg3dTriggerEntity,
} from '@gg-web-engine/core';
import { Gg3dVisualScene, GgRenderer, ThreeCamera, ThreeCameraEntity } from '@gg-web-engine/three';
import { Gg3dBody, Gg3dPhysicsWorld, Gg3dRaycastVehicle } from '@gg-web-engine/ammo';
import { BehaviorSubject, combineLatest, filter, first, Observable, pairwise, skip } from 'rxjs';
import { map } from 'rxjs/operators';
import { bumperCamera, farCamera, nearCamera } from './car-cameras';

type CurrentState =
  { mode: 'freecamera' }
  | { mode: 'driving', car: Gg3dRaycastVehicleEntity, carType: 'lambo' | 'truck' | 'car' };

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'fly-city';

  @ViewChild('stage') stage!: ElementRef<HTMLCanvasElement>;

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

  async ngOnInit(): Promise<void> {
    // TODO refactor this mess

    const scene: Gg3dVisualScene = new Gg3dVisualScene();
    const physScene: Gg3dPhysicsWorld = new Gg3dPhysicsWorld();
    const world: Gg3dWorld = new Gg3dWorld(scene, physScene, true);
    await world.init();

    const canvas = await GgViewportManager.instance.createCanvas(1);
    const renderer: GgRenderer = new GgRenderer(canvas, {}, new ThreeCameraEntity(
      new ThreeCamera(new PerspectiveCamera(75, 1, 1, 10000))
    ));
    world.addEntity(renderer);
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
          position: { x: (j - 5) * 75, y: (i - 5) * 75, z: 0 }
        }))
      ))
    );
    const map = new Gg3dMapGraphEntity(mapGraph, { loadDepth: 3 });
    map.loaderCursorEntity$.next(renderer.camera);
    map.chunkLoaded$.subscribe(async ([{ meta }, { position }]) => {
      // spawn cars
      const cars =
        await Promise.all(meta.dummies
          .filter(x => x.is_car && (Math.random() < (x.spawn_probability || 1)))
          .map(async dummy => {
            const [
              {
                resources: [{ object3D: chassisMesh, body: chassisBody }],
                meta: { dummies: chassisDummies }
              },
              { resources: [{ object3D: wheelMesh }] },
              specs,
            ] = await Promise.all([
              world.loader.loadGgGlbResources('assets/' + dummy.car_id),
              world.loader.loadGgGlbResources('assets/' + (dummy.car_id.startsWith('truck') ? 'truck_wheel' : 'wheel')),
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
        world.addEntity(car);
      }
    });
    world.addEntity(map);

    map.initialLoadComplete$.pipe(filter(x => !!x), first()).subscribe(async () => {
      world.start();

      const [
        {
          resources: [{ object3D: chassisMesh, body: chassisBody }],
          meta: { dummies: chassisDummies }
        },
        { resources: [{ object3D: wheelMesh }] },
        specs
      ] = await Promise.all([
          world.loader.loadGgGlbResources('assets/lambo/body'),
          world.loader.loadGgGlbResources('assets/lambo/wheel'),
          fetch(`assets/lambo/specs.json`).then(r => r.text()).then(r => JSON.parse(r))
        ]
      );
      const lambo = this.generateCar(physScene, chassisMesh, chassisBody, chassisDummies, wheelMesh, specs);
      lambo.name = 'lambo';
      world.addEntity(lambo);
      // TODO rename controllers (which are keyboard/mouse related) globally to something else
      const carController = new CarKeyboardController(world.keyboardController, lambo, {
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

      const playingArea = new Gg3dTriggerEntity(world.physicsWorld.factory.createTrigger({
        shape: 'BOX',
        dimensions: {x: 1000, y: 1000, z: 200},
      }));
      playingArea.position = { x: 0, y: 0, z: 90 };
      playingArea.onEntityLeft.subscribe((entity) => {
        if (!entity) {
          return;
        }
        const state = this.state$.getValue();
        if (state.mode === 'driving' && state.car === entity) {
          this.resetCar(map, carCameraController);
        } else {
          world.removeEntity(entity, true);
        }
      });
      world.addEntity(playingArea);

      world.keyboardController.bind('KeyC').pipe(
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
        world.keyboardController,
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
            world.removeEntity(carCameraController, false);
          } catch {
            //pass
          }
          freeCameraController.start();
        } else if (state.mode === 'driving') {
          freeCameraController.stop(false);
          carController.car = state.car;
          carController.start();
          world.addEntity(carCameraController);
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

      world.keyboardController.bind('KeyF').pipe(filter(x => x)).subscribe(() => {
        if (this.state$.getValue().mode === 'freecamera') {
          let distance = Number.MAX_SAFE_INTEGER;
          let car: Gg3dRaycastVehicleEntity | null = null;
          for (const entity of world.children) {
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

      world.keyboardController.bind('KeyR').pipe(filter(x => x)).subscribe(() => {
        this.resetCar(map, carCameraController);
      });

      // const cls = world.visualScene.debugPhysicsDrawerClass;
      // if (!cls) {
      //   throw new Error('Debug drawer is not available');
      // }
      // world.physicsWorld.startDebugger(world, new cls());

      // setTimeout(() => {
      //   world.pauseWorld();
      // }, 5000);
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
