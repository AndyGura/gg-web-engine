import {
  CachingStrategy,
  createInlineTickController,
  GgCarEntity,
  GgCarProperties,
  GgDummy,
  GgStatic,
  IEntity,
  IPositionable3d,
  MapGraph,
  MapGraph3dEntity,
  Pnt3,
  Qtrn,
  Renderer3dEntity,
  Trigger3dEntity,
} from '@gg-web-engine/core';
import { filter, firstValueFrom } from 'rxjs';
import { CAR_SPECS, LAMBO_SPECS, TRUCK_SPECS } from './car-specs';
import { FlyCityTypeDoc, FlyCityWorld } from './app.component';
import { takeUntil } from 'rxjs/operators';
import { Multiplayer } from './multiplayer';

const ASSETS = '/assets/fly-city';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

export class GameFactory {
  constructor(
    public readonly world: FlyCityWorld,
    /** set in multiplayer mode */
    public readonly mp: Multiplayer | null = null,
  ) {
  }

  public async initGame(canvas: HTMLCanvasElement): Promise<[Renderer3dEntity<FlyCityTypeDoc['vTypeDoc']>, MapGraph3dEntity<FlyCityTypeDoc>, Trigger3dEntity<FlyCityTypeDoc['pTypeDoc']>]> {
    await this.world.init();
    const renderer = await this.initRenderer(canvas);
    this.addLights();
    this.setupSkybox();
    const cityMapGraph = this.setupMapGraph(renderer);
    await firstValueFrom(cityMapGraph.initialLoadComplete$.pipe(filter(x => !!x)));
    const mapBounds = this.createMapBounds();
    return [renderer, cityMapGraph, mapBounds];
  }

  private async initRenderer(canvas: HTMLCanvasElement): Promise<Renderer3dEntity<FlyCityTypeDoc['vTypeDoc']>> {
    const renderer = this.world.addRenderer(
      this.world.visualScene.factory.createPerspectiveCamera({ fov: 75 }),
      canvas,
      {
        background: 0xffffff,
      },
    );
    renderer.camera.position = { x: 0, y: -15, z: 10 };
    renderer.camera.rotation = Qtrn.lookAt(renderer.camera.position, Pnt3.O);
    return renderer;
  }

  private addLights() {
    this.world.addLight({ type: 'DIRECTIONAL', intensity: 3 }, { x: 200, y: 150, z: 120 }, Pnt3.O);
    this.world.addLight({ type: 'DIRECTIONAL', color: 0xaaaaff, intensity: 0.4 }, { x: -200, y: -150, z: 20 }, Pnt3.O);
  }

  private async setupSkybox() {
    // the city streams in 3 tiles (225m) around the camera: fade buildings into the sky's horizon
    // color before that distance, so tiles don't pop in at the edge
    this.world.visualScene.setEnvironment({ fog: { type: 'LINEAR', color: 0xabeafc, near: 80, far: 225 } });
    const sky = await this.world.visualScene.loader.loadCubeTexture({
      px: `${ASSETS}/sky_px.png`,
      nx: `${ASSETS}/sky_nx.png`,
      py: `${ASSETS}/sky_py.png`,
      ny: `${ASSETS}/sky_ny.png`,
      pz: `${ASSETS}/sky_pz.png`,
      nz: `${ASSETS}/sky_nz.png`,
    });
    this.world.visualScene.setEnvironment({ background: sky });
  }

  private setupMapGraph(renderCursor: (IEntity & IPositionable3d)): MapGraph3dEntity<FlyCityTypeDoc> {
    const mapGraph = MapGraph.fromMapSquareGrid(
      Array(11).fill(null).map((_, i) => (
        Array(11).fill(null).map((_, j) => ({
          path: 'https://gg-web-demos.guraklgames.com/assets/fly-city/city_tile',
          position: { x: (j - 5) * 75, y: (i - 5) * 75, z: 0 },
          loadOptions: {
            cachingStrategy: CachingStrategy.Entities,
          },
        }))
      )),
    );
    const cityMapGraph = new MapGraph3dEntity<FlyCityTypeDoc>(mapGraph, { loadDepth: 3, inertia: 2 });
    createInlineTickController(this.world).pipe(
      takeUntil(cityMapGraph.onRemoved$),
      takeUntil(renderCursor.onRemoved$),
    ).subscribe(() => {
      cityMapGraph.loaderCursor$.next(renderCursor.position);
    });
    cityMapGraph.chunkLoaded$.subscribe(async ([{ meta }, { position }, node]) => {
      // spawn cars - in multiplayer the dice are seeded per room and tile, so every peer streaming
      // this tile spawns the very same cars (with the same names) and they can be shared content
      const random = this.mp ? this.mp.tileRandom(position.x, position.y) : Math.random;
      // `dummy.car_id` (e.g. "car_0") is the shared model type, not a unique identifier - the
      // same tile can (and typically does) carry many dummies for the same car_id as
      // alternative spawn points, and the same relative dummy name (e.g. "car_spawner.003")
      // recurs in every tile too, so both need to be in the name to keep it world-wide unique;
      // `position` (the tile's own world position) is unique per tile in this grid.
      const carName = (dummy: GgDummy) => `${dummy.car_id}__${position.x}_${position.y}__${dummy.name}`;
      const cars =
        await Promise.all(meta.dummies
          .filter(x => x.is_car && (random() < (x.spawn_probability || 1) / 3))
          // a car that was driven away from this tile outlives it (see `GameRunner`): when the tile
          // loads again while that car is still around, its spawn point stays empty. Filtered after
          // the dice roll, so the seeded sequence stays the same for every peer
          .filter(dummy => !this.hasEntity(carName(dummy)))
          .map(async dummy => {
            const [
              {
                resources: [{ object3D: chassisMesh, body: chassisBody }],
                meta: { dummies: chassisDummies },
              },
              { resources: [{ object3D: wheelMesh }] },
            ] = await Promise.all([
              this.world.loader.loadGgGlbResources('https://gg-web-demos.guraklgames.com/assets/fly-city/' + dummy.car_id),
              this.world.loader.loadGgGlbResources('https://gg-web-demos.guraklgames.com/assets/fly-city/' + (dummy.car_id.startsWith('truck') ? 'truck_wheel' : 'wheel')),
            ]);
            if (!chassisBody) {
              console.error('Cannot spawn car without chassis body');
              return null;
            }
            const entity = this.generateCar(chassisMesh, chassisBody, chassisDummies, wheelMesh, (dummy.car_id.startsWith('truck') ? TRUCK_SPECS : CAR_SPECS));
            entity.name = carName(dummy);
            entity.position = Pnt3.add(position, dummy.position);
            entity.rotation = dummy.rotation;
            return entity;
          }),
        );
      const spawned = cars.filter((car): car is GgCarEntity => {
        if (car && this.hasEntity(car.name)) {
          // showed up while this one's model was loading - before `markShared`, so the duplicate
          // is never registered with the network
          car.dispose();
          return false;
        }
        return !!car;
      });
      // every peer builds these itself: only their state travels; a peer loading the tile later asks
      // the room for it, and unloading the tile is just a local unload
      this.mp?.net.markShared(spawned);
      if (cityMapGraph.loaded.has(node)) {
        // tie these cars to the chunk's own lifecycle so they're removed automatically when this
        // chunk unloads - otherwise they leak (and, on a later reload of the same chunk, collide by
        // name with the still-leaked copy). Attached one at a time (not as a single
        // `attachToChunk(node, spawned)` batch) and guarded individually: `IEntity.addChildren`
        // stops at the first entity that fails to add, so a single name collision inside a batch
        // (e.g. the same chunk having been mid-load twice concurrently - see `MapGraph3dEntity`'s
        // own `loadingNodes` doc for when that could happen) used to silently drop every car after
        // the colliding one in that batch, not just the offending one.
        for (const car of spawned) {
          try {
            cityMapGraph.attachToChunk(node, [car]);
          } catch (e) {
            console.warn(`Failed to spawn car "${car.name}" - disposing it instead`, e);
            car.dispose();
          }
        }
      } else {
        // the chunk was already unloaded while these cars were still loading - discard them instead
        // of leaking their never-added native resources
        for (const car of spawned) {
          car.dispose();
        }
      }
    });
    this.world.addEntity(cityMapGraph);
    return cityMapGraph;
  }

  private hasEntity(name: string): boolean {
    try {
      this.world.getEntityByName(name);
      return true;
    } catch {
      return false;
    }
  }

  public createMapBounds(): Trigger3dEntity<FlyCityTypeDoc['pTypeDoc']> {
    const playingArea = new Trigger3dEntity<FlyCityTypeDoc['pTypeDoc']>(this.world.physicsWorld.factory.createTrigger({
      shape: 'BOX',
      dimensions: { x: 1000, y: 1000, z: 200 },
    }));
    playingArea.position = { x: 0, y: 0, z: 90 };
    this.world.addEntity(playingArea);
    return playingArea;
  }

  public async spawnLambo(): Promise<GgCarEntity> {
    const [
      {
        resources: [{ object3D: chassisMesh, body: chassisBody }],
        meta: { dummies: chassisDummies },
      },
      { resources: [{ object3D: wheelMesh }] },
    ] = await Promise.all([
        this.world.loader.loadGgGlbResources('https://gg-web-demos.guraklgames.com/assets/fly-city/lambo/body'),
        this.world.loader.loadGgGlbResources('https://gg-web-demos.guraklgames.com/assets/fly-city/lambo/wheel'),
      ],
    );
    const lambo = this.generateCar(chassisMesh, chassisBody!, chassisDummies, wheelMesh, LAMBO_SPECS);
    lambo.name = 'lambo';
    this.mp?.net.markShared(lambo); // every peer spawns its own lambo at start
    this.world.addEntity(lambo);
    return lambo;
  }

  private generateCar(
    chassisMesh: FlyCityTypeDoc['vTypeDoc']['displayObject'] | null, chassisBody: FlyCityTypeDoc['pTypeDoc']['rigidBody'],
    chassisDummies: GgDummy[], wheelMesh: FlyCityTypeDoc['vTypeDoc']['displayObject'] | null, specs: Omit<GgCarProperties, 'wheelOptions'>,
  ): GgCarEntity {
    return new GgCarEntity(
      {
        wheelOptions: chassisDummies
          .filter(x => x.name.startsWith('wheel_'))
          .map((wheel) => {
            return {
              tyreRadius: wheel.tyre_radius || 0.3,
              tyreWidth: wheel.tyre_width || 0.4,
              position: wheel.position,
              isFront: wheel.name.startsWith('wheel_f'),
              isLeft: wheel.name.endsWith('l'),
            };
          }),
        sharedWheelOptions: {
          frictionSlip: 10,
          rollInfluence: 0.2,
          maxTravel: 0.5,
          display: { displayObject: wheelMesh || undefined, wheelObjectDirection: 'x', autoScaleMesh: true },
        },
        ...specs,
      },
      chassisMesh,
      this.world.physicsWorld.factory.createRaycastVehicle(chassisBody),
    );
  }

}
