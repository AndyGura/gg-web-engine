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
  averageAngle,
  CarKeyboardController,
  createInlineTickController,
  FreeCameraController,
  Gg3dEntity,
  Gg3dMapGraphEntity,
  Gg3dRaycastVehicleEntity,
  Gg3dWorld,
  GgViewportManager,
  MapGraph,
  Pnt3,
  Qtrn
} from '@gg-web-engine/core';
import { Gg3dVisualScene, GgRenderer, ThreeCamera, ThreeCameraEntity } from '@gg-web-engine/three';
import { Gg3dBody, Gg3dPhysicsWorld, Gg3dRaycastVehicle } from '@gg-web-engine/ammo';
import { filter, first } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'fly-city';

  @ViewChild('stage') stage!: ElementRef<HTMLCanvasElement>;

  car: Gg3dRaycastVehicleEntity | null = null;

  async ngOnInit(): Promise<void> {

    const scene: Gg3dVisualScene = new Gg3dVisualScene();
    const physScene: Gg3dPhysicsWorld = new Gg3dPhysicsWorld();
    const world: Gg3dWorld = new Gg3dWorld(scene, physScene, true);
    await world.init();

    const canvas = await GgViewportManager.instance.createCanvas(1);
    const renderer: GgRenderer = new GgRenderer(canvas, {}, new ThreeCameraEntity(
      new ThreeCamera(new PerspectiveCamera(75, 1, 1, 10000))
    ));
    world.addEntity(renderer);
    renderer.camera.position = { x: 0, y: 0, z: 10 };
    renderer.camera.rotation = Qtrn.lookAt(
      renderer.camera.position,
      { x: 0, y: 10, z: 10 },
      { x: 0, y: 0, z: 1 },
    );
    renderer.activate();

    const freeCameraController: FreeCameraController = new FreeCameraController(
      world.keyboardController,
      renderer.camera,
      {
        movementOptions: {
          speed: 2,
        },
        mouseOptions: {
          pointerLock: {
            ignoreMovementWhenNotLocked: true,
            canvas,
          },
        },
      },
    );
    freeCameraController.start();

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
        Array(10).fill(null).map((_, j) => ({ path: 'assets/city_tile', position: { x: (j - 5) * 75, y: (i - 5) * 75, z: 0 }}))
      ))
    );
    const map = new Gg3dMapGraphEntity(mapGraph, { loadDepth: 3 });
    world.addEntity(map);
    map.loaderCursorEntity$.next(renderer.camera);

    map.initialLoadComplete$.pipe(filter(x => !!x), first()).subscribe(async () => {
      world.start();

      const [{ resources: [{ object3D: chassisMesh, body: chassisBody }], meta: { dummies: chassisDummies } }, { resources: [{ object3D: wheelMesh }] }] = await Promise.all([
        world.loader.loadGgGlbResources('assets/testCar/body'),
        world.loader.loadGgGlbResources('assets/testCar/wheel'),
      ]);

      this.car = new Gg3dRaycastVehicleEntity(
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
          mpsToRpmFactor: 104.0,
          typeOfDrive: 'RWD',
          engine: {
            minRpm: 700,
            maxRpm: 7240,
            maxRpmIncreasePerSecond: 8000,
            maxRpmDecreasePerSecond: 8000,
            torques: [
              { rpm: 1000, torque: 270 }, { rpm: 1200, torque: 290 }, { rpm: 1400, torque: 320 }, { rpm: 1600, torque: 340 },
              { rpm: 1800, torque: 357 }, { rpm: 2000, torque: 365 }, { rpm: 2200, torque: 370 }, { rpm: 2400, torque: 377 },
              { rpm: 2600, torque: 382 }, { rpm: 2800, torque: 385 }, { rpm: 3000, torque: 390 }, { rpm: 3200, torque: 392 },
              { rpm: 3400, torque: 395 }, { rpm: 3600, torque: 398 }, { rpm: 3800, torque: 405 }, { rpm: 4000, torque: 410 },
              { rpm: 4200, torque: 420 }, { rpm: 4400, torque: 440 }, { rpm: 4600, torque: 460 }, { rpm: 4800, torque: 470 },
              { rpm: 5000, torque: 480 }, { rpm: 5200, torque: 485 }, { rpm: 5400, torque: 490 }, { rpm: 5600, torque: 490 },
              { rpm: 5800, torque: 487 }, { rpm: 6000, torque: 485 }, { rpm: 6200, torque: 470 }, { rpm: 6400, torque: 460 },
              { rpm: 6600, torque: 450 }, { rpm: 6800, torque: 440 }, { rpm: 7000, torque: 430 }, { rpm: 7200, torque: 420 },
              { rpm: 7400, torque: 410 }, { rpm: 7600, torque: 400 }, { rpm: 7800, torque: 390 }, { rpm: 8000, torque: 380 },
              { rpm: 8200, torque: 370 }, { rpm: 8400, torque: 360 }, { rpm: 8600, torque: 350 }, { rpm: 8800, torque: 340 },
              { rpm: 9000, torque: 330 }, { rpm: 9200, torque: 320 }, { rpm: 9400, torque: 300 }, { rpm: 9600, torque: 280 },
              { rpm: 9800, torque: 260 }, { rpm: 10000, torque: 240 }, { rpm: 10200, torque: 220 }, { rpm: 10400, torque: 200 },
              { rpm: 10600, torque: 180 }, { rpm: 10800, torque: 160 }, { rpm: 11000, torque: 140 }],
          },
          transmission: {
            isAuto: true,
            drivelineEfficiency: 0.85,
            finalDriveRatio: 3.21,
            reverseGearRatio: -2.33,
            gearRatios: [2.92, 1.87, 1.42, 1.09, 0.81],
            upShifts: [ 7140, 7140, 7140, 7140, 2829625512]
          },
          suspension: { stiffness: 20.0, damping: 2.3, compression: 4.4, restLength: 0.53 },
        },
        chassisMesh,
        new Gg3dRaycastVehicle(
          physScene,
          (chassisBody as Gg3dBody).nativeBody,
        ),
        wheelMesh,
        'x',
      );
      this.car.position = { x: 0, y: 0, z: 1};
      this.car.gear = 1;
      world.addEntity(this.car);
      const c = new CarKeyboardController(world.keyboardController, this.car);
      c.start();
      const elasticAngle: (inertia: number, easing?: (x: number) => number) => ((value: number, deltaMs: number) => number) =
        (inertia: number, easing: ((x: number) => number) = x => x) => {
          let latestValue: number | null = null;
          return (value, deltaMs) => {
            if (latestValue !== null) {
              let newFactor = easing(deltaMs / inertia);
              if (newFactor < 1) {
                value = averageAngle(latestValue, value, newFactor);
              }
            }
            latestValue = value;
            return value;
          };
        };
      const elasticZAngle = elasticAngle(250);
      createInlineTickController(world).subscribe(([elapsed, delta]) => {
        const vectorLength = 6.5;
        const vectorAngle = 0.3948;
        const objectPosition = this.car!.position;
        const carVector = Pnt3.rot({ x: 0, y: 1, z: 0}, this.car!.rotation);
        // FIXME jitters when turning during FPS drop, but elasticZAngle calculation is correct
        const zAngle = elasticZAngle(Math.atan2(carVector.y, carVector.x) - Math.PI / 2, delta);
        const cameraVector = Pnt3.rotAround(
          Pnt3.rotAround(
            { x: 0, y: -vectorLength, z: 0 },
            { x: 1, y: 0, z: 0 },
            -vectorAngle
          ),
          { x: 0, y: 0, z: 1 },
          zAngle
        );
        let cameraTargetVector = { x: 0, y: 0, z: vectorLength * Math.sin(vectorAngle) };
        renderer.camera.position = Pnt3.add(objectPosition, cameraVector);
        renderer.camera.rotation = Qtrn.lookAt(
          renderer.camera.position,
          Pnt3.add(objectPosition, cameraTargetVector),
          Pnt3.norm(cameraTargetVector),
        );
      });
      freeCameraController.stop();


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
}
