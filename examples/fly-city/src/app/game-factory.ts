import {
  CachingStrategy,
  CarProperties,
  Gg3dMapGraphEntity,
  Gg3dRaycastVehicleEntity,
  Gg3dTriggerEntity,
  Gg3dWorld,
  GgDummy,
  GgPositionable3dEntity,
  GgViewportManager,
  IGg3dObject,
  MapGraph,
  Pnt3,
  Qtrn,
} from '@gg-web-engine/core';
import { Gg3dVisualScene, GgRenderer, ThreeCamera, ThreeCameraEntity } from '@gg-web-engine/three';
import { Gg3dBody, Gg3dPhysicsWorld, Gg3dRaycastVehicle, } from '@gg-web-engine/ammo';
import {
  CubeReflectionMapping,
  CubeTexture,
  CubeTextureLoader,
  DirectionalLight,
  PerspectiveCamera,
  RGBAFormat
} from 'three';
import { filter, firstValueFrom } from 'rxjs';
import { CAR_SPECS, LAMBO_SPECS, TRUCK_SPECS } from './car-specs';

export class GameFactory {
  constructor(public readonly world: Gg3dWorld<Gg3dVisualScene, Gg3dPhysicsWorld>) {
  }

  public async initGame(): Promise<[GgRenderer, Gg3dMapGraphEntity, Gg3dTriggerEntity]> {
    await this.world.init();
    const renderer = await this.initRenderer();
    this.addLights();
    this.setupSkybox();
    const cityMapGraph = this.setupMapGraph(renderer.camera);
    await firstValueFrom(cityMapGraph.initialLoadComplete$.pipe(filter(x => !!x)));
    const mapBounds = this.createMapBounds();
    return [renderer, cityMapGraph, mapBounds];
  }

  private async initRenderer(): Promise<GgRenderer> {
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
    return renderer;
  }

  private addLights() {
    const sun = new DirectionalLight(0xffffff, 3);
    sun.position.set(200, 150, 120);
    this.world.visualScene.nativeScene?.add(sun);
    const sky = new DirectionalLight(0xaaaaff, 0.4);
    sky.position.set(-200, -150, 20);
    this.world.visualScene.nativeScene?.add(sky);
  }

  private setupSkybox() {
    const envMap: CubeTexture = new CubeTextureLoader()
      .setPath(`assets/`)
      .load([
        'sky_nx.png', 'sky_px.png',
        'sky_py.png', 'sky_ny.png',
        'sky_pz.png', 'sky_nz.png'
      ]);
    envMap.format = RGBAFormat;
    envMap.mapping = CubeReflectionMapping;
    this.world.visualScene.nativeScene!.background = envMap;
  }

  private setupMapGraph(renderCursor: GgPositionable3dEntity): Gg3dMapGraphEntity {
    const mapGraph = MapGraph.fromMapSquareGrid(
      Array(11).fill(null).map((_, i) => (
        Array(11).fill(null).map((_, j) => ({
          path: 'assets/city_tile',
          position: { x: (j - 5) * 75, y: (i - 5) * 75, z: 0 },
          loadOptions: {
            cachingStrategy: CachingStrategy.Entities,
          },
        }))
      ))
    );
    const cityMapGraph = new Gg3dMapGraphEntity(mapGraph, { loadDepth: 3, inertia: 2 });
    cityMapGraph.loaderCursorEntity$.next(renderCursor);
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
            ] = await Promise.all([
              // TODO use caching strategy "Entities" after cloned Ammo.js object mass will be fixed
              this.world.loader.loadGgGlbResources('assets/' + dummy.car_id, CachingStrategy.Files),
              this.world.loader.loadGgGlbResources('assets/' + (dummy.car_id.startsWith('truck') ? 'truck_wheel' : 'wheel'), CachingStrategy.Files),
            ]);
            if (!chassisBody) {
              console.error('Cannot spawn car without chassis body');
              return null;
            }
            const entity = this.generateCar(chassisMesh, chassisBody as Gg3dBody, chassisDummies, wheelMesh, (dummy.car_id.startsWith('truck') ? TRUCK_SPECS : CAR_SPECS));
            entity.name = dummy.car_id;
            entity.position = Pnt3.add(position, dummy.position);
            entity.rotation = dummy.rotation;
            return entity;
          }),
        );
      for (const car of cars) {
        if (car) {
          this.world.addEntity(car);
        }
      }
    });
    this.world.addEntity(cityMapGraph);
    return cityMapGraph;
  }

  public createMapBounds(): Gg3dTriggerEntity {
    const playingArea = new Gg3dTriggerEntity(this.world.physicsWorld.factory.createTrigger({
      shape: 'BOX',
      dimensions: { x: 1000, y: 1000, z: 200 },
    }));
    playingArea.position = { x: 0, y: 0, z: 90 };
    this.world.addEntity(playingArea);
    return playingArea;
  }

  public async spawnLambo(): Promise<Gg3dRaycastVehicleEntity> {
    const [
      {
        resources: [{ object3D: chassisMesh, body: chassisBody }],
        meta: { dummies: chassisDummies }
      },
      { resources: [{ object3D: wheelMesh }] }
    ] = await Promise.all([
        this.world.loader.loadGgGlbResources('assets/lambo/body'),
        this.world.loader.loadGgGlbResources('assets/lambo/wheel'),
      ]
    );
    const lambo = this.generateCar(chassisMesh, chassisBody as Gg3dBody, chassisDummies, wheelMesh, LAMBO_SPECS);
    lambo.name = 'lambo';
    this.world.addEntity(lambo);
    return lambo;
  }

  private generateCar(
    chassisMesh: IGg3dObject | null, chassisBody: Gg3dBody,
    chassisDummies: GgDummy[], wheelMesh: IGg3dObject | null, specs: Omit<CarProperties, 'wheelOptions'>
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
        this.world.physicsWorld,
        chassisBody.nativeBody,
      ),
      wheelMesh,
      'x',
    );
  }

}
