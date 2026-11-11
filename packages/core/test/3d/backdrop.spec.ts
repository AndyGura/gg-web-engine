import {
  AudioSource3dEntity,
  Backdrop3dEntity,
  DEFAULT_BACKDROP_SCALE,
  Entity3d,
  Environment3dEntity,
  Environment3dOpts,
  Frame3d,
  Gg3dWorld,
  IEntity,
  isSceneOwner,
  LevelJson,
  Light3dDescriptor,
  Light3dEntity,
  Pnt3,
  Point3,
  Qtrn,
  resolveVisualScene,
  TickOrder,
} from '../../src';
import { mock3DObject } from '../mocks/object.mock';
import { mock3DBody } from '../mocks/body.mock';
import { mock3DAudioSource } from '../mocks/audio-source.mock';

type MockScene = ReturnType<typeof mockScene>;

/**
 * A display object that records which scene it was attached to, through `resolveVisualScene`.
 * `extra` is merged in place: a spread copy's methods would still record the original object.
 */
const recordingObject = (extra: Record<string, unknown> = {}) => {
  const result: any = Object.assign(mock3DObject(), extra, {
    entity: null,
    addToWorld(world: Gg3dWorld) {
      resolveVisualScene<MockScene>(result.entity, world as any).attached.add(result);
    },
    removeFromWorld(world: Gg3dWorld) {
      resolveVisualScene<MockScene>(result.entity, world as any).attached.delete(result);
    },
    dispose: jest.fn(),
  });
  return result;
};

const mockCamera = (fov = 60) => recordingObject({ supportsFov: true, fov });

const mockScene = (label: string = 'main') => {
  let environment: Environment3dOpts<string> = { background: null, environmentMap: null, fog: null };
  const scene = {
    label,
    attached: new Set<any>(),
    backdropScenes: [] as any[],
    init: jest.fn(async () => {}),
    dispose: jest.fn(),
    factory: {
      createPerspectiveCamera: jest.fn((_settings?: any) => mockCamera()),
      createLight: jest.fn((descriptor: Light3dDescriptor) => recordingObject({ lightOptions: descriptor })),
    },
    loader: {},
    get environment() {
      return environment;
    },
    setEnvironment: jest.fn((e: Partial<Environment3dOpts<string>>) => {
      environment = { ...environment, ...e };
    }),
    createBackdropScene: jest.fn((): any => {
      const backdrop = mockScene(`backdrop${scene.backdropScenes.length}`);
      scene.backdropScenes.push(backdrop);
      return backdrop;
    }),
  };
  return scene;
};

const displayEntity = (position: Point3 = Pnt3.O) => {
  const entity = new Entity3d({ object3D: recordingObject() });
  entity.position = position;
  return entity;
};

const close = (a: Point3, b: Point3) => {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
  expect(a.z).toBeCloseTo(b.z, 9);
};

describe('Backdrop3dEntity', () => {
  let scene: MockScene;
  let world: Gg3dWorld;

  beforeEach(async () => {
    scene = mockScene();
    world = new Gg3dWorld({ visualScene: scene as any });
    await world.init();
  });

  afterEach(() => world.dispose());

  it('addBackdrop creates the scene through createBackdropScene, initializes it and spawns the backdrop', async () => {
    const backdrop = await world.addBackdrop();
    expect(scene.createBackdropScene).toHaveBeenCalledTimes(1);
    expect(scene.backdropScenes[0].init).toHaveBeenCalled();
    expect(backdrop.ownedScene).toBe(scene.backdropScenes[0]);
    expect(backdrop.world).toBe(world);
    expect(backdrop.scale).toBe(DEFAULT_BACKDROP_SCALE);
    expect(backdrop.scale).toBe(1 / 16);
    expect(backdrop.name).toMatch(/^Backdrop3dEntity_/);
    expect(isSceneOwner(backdrop)).toBe(true);
    expect(scene.backdropScenes[0].factory.createPerspectiveCamera).toHaveBeenCalledWith({
      frustrum: { near: 0.05, far: 10000 },
    });
  });

  it('rejects an invalid scale', () => {
    expect(() => new Backdrop3dEntity(mockScene() as any, { scale: -1 })).toThrow(/scale/);
    expect(() => new Backdrop3dEntity(mockScene() as any, { scale: NaN })).toThrow(/scale/);
  });

  describe('poseCameraFor', () => {
    const P = { x: 32, y: -16, z: 8 };
    const R = Qtrn.fromEuler({ x: 0.3, y: -0.2, z: 1.1 });

    it.each([
      [0, Pnt3.O, Pnt3.O, Pnt3.O],
      [1 / 16, Pnt3.O, Pnt3.O, { x: 2, y: -1, z: 0.5 }],
      [1, Pnt3.O, Pnt3.O, P],
      [1 / 16, { x: 16, y: 16, z: 0 }, { x: 5, y: 0, z: -1 }, { x: 6, y: -2, z: -0.5 }],
      [0, { x: 16, y: 16, z: 0 }, { x: 5, y: 0, z: -1 }, { x: 5, y: 0, z: -1 }],
    ])('scale %p, anchor %p onto %p: places the camera at %p', async (scale, anchor, anchorInBackdrop, expected) => {
      const backdrop = await world.addBackdrop({ scale, anchor, anchorInBackdrop });
      const main = mockCamera(75);
      main.position = P;
      main.rotation = R;
      backdrop.poseCameraFor(main);
      close(backdrop.camera.position, expected);
      expect(backdrop.camera.rotation).toEqual(R);
      expect(backdrop.camera.fov).toBe(75);
    });

    it('maps through the world frame (global coordinates)', async () => {
      world.frame = { position: { x: 100, y: 0, z: 0 }, yaw: Math.PI / 2 };
      const backdrop = await world.addBackdrop({ scale: 0.5 });
      const main = mockCamera();
      main.position = { x: 10, y: 0, z: 2 };
      main.rotation = Qtrn.O;
      backdrop.poseCameraFor(main);
      // global = rotZ(90°) * local + position = (100, 10, 2)
      close(backdrop.camera.position, { x: 50, y: 5, z: 1 });
      const yaw = Qtrn.fromAngle(Pnt3.Z, Math.PI / 2);
      close(Pnt3.rot(Pnt3.X, backdrop.camera.rotation), Pnt3.rot(Pnt3.X, yaw));
    });

    it('scale and anchors are live', async () => {
      const backdrop = await world.addBackdrop();
      const main = mockCamera();
      main.position = { x: 10, y: 0, z: 0 };
      backdrop.scale = 0.1;
      backdrop.anchorInBackdrop = { x: 0, y: 0, z: 3 };
      backdrop.poseCameraFor(main);
      close(backdrop.camera.position, { x: 1, y: 0, z: 3 });
    });
  });

  it('switchFrame leaves the pose and the backdrop content untouched while the world content moves', async () => {
    const backdrop = await world.addBackdrop({ scale: 1 / 16 });
    const mountain = displayEntity({ x: 3, y: 4, z: 0 });
    backdrop.addChildren(mountain);
    const house = displayEntity({ x: 10, y: 0, z: 0 });
    world.addEntity(house);
    const cameraEntity = new Entity3d({ object3D: mockCamera() });
    cameraEntity.position = { x: 20, y: 5, z: 2 };
    cameraEntity.rotation = Qtrn.fromEuler({ x: 0.1, y: 0, z: 0.4 });
    world.addEntity(cameraEntity);
    const camera = cameraEntity.object3D as any;

    backdrop.poseCameraFor(camera);
    const posed = { position: backdrop.camera.position, rotation: backdrop.camera.rotation };

    world.switchFrame(new Frame3d({ x: 50, y: -20, z: 0 }, 0.7));

    expect(house.position).not.toEqual({ x: 10, y: 0, z: 0 });
    expect(mountain.position).toEqual({ x: 3, y: 4, z: 0 });
    backdrop.poseCameraFor(camera);
    close(backdrop.camera.position, posed.position);
    close(Pnt3.rot(Pnt3.X, backdrop.camera.rotation), Pnt3.rot(Pnt3.X, posed.rotation));
    close(Pnt3.rot(Pnt3.Z, backdrop.camera.rotation), Pnt3.rot(Pnt3.Z, posed.rotation));
  });

  it("draws its children's components into its own scene, also when added before it spawns", async () => {
    const early = displayEntity();
    const backdrop = new Backdrop3dEntity(mockScene('own') as any);
    backdrop.addChildren(early);
    expect(early.world).toBeNull();
    world.addEntity(backdrop);
    const late = displayEntity();
    backdrop.addChildren(late);
    const own = backdrop.ownedScene as unknown as MockScene;
    expect(own.attached.has(early.object3D)).toBe(true);
    expect(own.attached.has(late.object3D)).toBe(true);
    expect(scene.attached.size).toBe(0);
    // children are ordinary entities of the world
    expect(world.getEntityByName(late.name)).toBe(late);
    expect(world.children).toContain(early);

    world.removeEntity(backdrop);
    expect(own.attached.size).toBe(0);
  });

  it('takes an entity that is already in the world on its own over into its scene', async () => {
    const backdrop = await world.addBackdrop();
    const loose = displayEntity();
    world.addEntity(loose);
    expect(scene.attached.has(loose.object3D)).toBe(true);
    backdrop.addChildren(loose);
    expect(scene.attached.has(loose.object3D)).toBe(false);
    expect((backdrop.ownedScene as unknown as MockScene).attached.has(loose.object3D)).toBe(true);
    expect(loose.parent).toBe(backdrop);
  });

  it('ticks its children with the world', async () => {
    const backdrop = await world.addBackdrop();
    class Counter extends IEntity {
      static readonly entityTypeName: string = 'Counter';
      readonly tickOrder = TickOrder.CONTROLLERS;
      ticks = 0;
      onSpawned(w: any) {
        super.onSpawned(w);
        this.onTick(() => this.ticks++);
      }
    }
    const counter = new Counter();
    backdrop.addChildren(counter);
    world.start();
    world.worldClock.pause();
    world.worldClock.step(16);
    expect(counter.ticks).toBe(1);
  });

  it('refuses a child with a physics component, naming the entity', async () => {
    const backdrop = await world.addBackdrop();
    backdrop.name = 'Horizon';
    const crate = new Entity3d({ object3D: recordingObject(), objectBody: mock3DBody() });
    crate.name = 'Crate';
    expect(() => backdrop.addChildren(crate)).toThrow(/Horizon.*"Crate".*physics/);
    expect(crate.parent).toBeNull();
    // nested deeper too
    const group = new Entity3d({});
    group.addChildren(crate);
    expect(() => backdrop.addChildren(group)).toThrow(/physics/);
  });

  it('refuses a child with an audio source', async () => {
    const backdrop = await world.addBackdrop();
    const sound = new AudioSource3dEntity(mock3DAudioSource() as any);
    expect(() => backdrop.addChildren(sound)).toThrow(/audio/);
  });

  it('checks a subtree that grew after addChildren when it spawns', () => {
    const backdrop = new Backdrop3dEntity(mockScene('own') as any);
    const group = new Entity3d({});
    backdrop.addChildren(group);
    group.addChildren(new Entity3d({ objectBody: mock3DBody() }));
    expect(() => world.addEntity(backdrop)).toThrow(/physics/);
    expect(backdrop.world).toBeNull();
  });

  describe('environment', () => {
    it('setEnvironment applies fog and environment map to the backdrop scene, not the world', async () => {
      const backdrop = await world.addBackdrop();
      const fog = { type: 'LINEAR' as const, color: 0xd9b48a, near: 40, far: 400 };
      backdrop.setEnvironment({ fog });
      expect((backdrop.ownedScene as any).environment.fog).toEqual(fog);
      expect(scene.environment.fog).toBeNull();
    });

    it('setEnvironment throws on a background', async () => {
      const backdrop = await world.addBackdrop();
      expect(() => backdrop.setEnvironment({ background: 0xff0000 } as any)).toThrow(/no background of its own/);
      expect((backdrop.ownedScene as any).setEnvironment).not.toHaveBeenCalled();
    });

    it('a child Environment3dEntity applies to the backdrop scene and restores it when removed', async () => {
      const backdrop = await world.addBackdrop();
      const own = backdrop.ownedScene as unknown as MockScene;
      const fog = { type: 'EXPONENTIAL' as const, color: 0x123456, density: 0.1 };
      const environment = new Environment3dEntity({ fog });
      backdrop.addChildren(environment);
      expect(own.environment.fog).toEqual(fog);
      expect(scene.setEnvironment).not.toHaveBeenCalled();
      backdrop.removeChildren([environment]);
      expect(own.environment.fog).toBeNull();
    });

    it('a child Environment3dEntity with a background throws', async () => {
      const backdrop = await world.addBackdrop();
      const environment = new Environment3dEntity({ background: 0xffffff });
      expect(() => backdrop.addChildren(environment)).toThrow(/no background of its own/);
      expect(environment.world).toBeNull();
      expect(scene.setEnvironment).not.toHaveBeenCalled();
    });

    it('a top-level Environment3dEntity still applies to the world scene', () => {
      world.addEntity(new Environment3dEntity({ background: 0x88bbee }));
      expect(scene.environment.background).toBe(0x88bbee);
    });
  });

  it('world.backdrops lists spawned backdrops in ascending scale, live', async () => {
    const near = await world.addBackdrop({ scale: 1 / 16 });
    const far = await world.addBackdrop({ scale: 1 / 256 });
    const infinite = await world.addBackdrop({ scale: 0 });
    expect(world.backdrops).toEqual([infinite, far, near]);
    infinite.scale = 1;
    expect(world.backdrops).toEqual([far, near, infinite]);
    world.removeEntity(far);
    expect(world.backdrops).toEqual([near, infinite]);
  });

  it('dispose disposes its camera, its scene and its children', async () => {
    const backdrop = await world.addBackdrop();
    const child = displayEntity();
    backdrop.addChildren(child);
    const own = backdrop.ownedScene as unknown as MockScene;
    const camera = backdrop.camera as any;
    world.removeEntity(backdrop, true);
    expect(own.dispose).toHaveBeenCalledTimes(1);
    expect(camera.dispose).toHaveBeenCalledTimes(1);
    expect(child.disposed).toBe(true);
    expect(world.backdrops).toEqual([]);
    backdrop.dispose();
    expect(own.dispose).toHaveBeenCalledTimes(1);
  });

  it('addBackdrop throws without a visual scene', async () => {
    const bare = new Gg3dWorld({});
    await expect(bare.addBackdrop()).rejects.toThrow(/visual scene/);
    bare.dispose();
  });
});

describe('"Backdrop" level class', () => {
  let scene: MockScene;
  let world: Gg3dWorld;

  beforeEach(async () => {
    scene = mockScene();
    world = new Gg3dWorld({ visualScene: scene as any });
    await world.init();
  });

  afterEach(() => world.dispose());

  it('builds its children with the same loader, attached before it spawns, into its scene', async () => {
    const built: { spawnedParent: IEntity | null; world: unknown }[] = [];
    class Marker extends IEntity {
      static readonly entityTypeName: string = 'Marker';
      readonly tickOrder = TickOrder.CONTROLLERS;
      onSpawned(w: any) {
        built.push({ spawnedParent: this.parent, world: w });
        super.onSpawned(w);
      }
    }
    world.loader.registerClass('Marker', () => new Marker());
    const fog = { type: 'LINEAR' as const, color: 0xd9b48a, near: 40, far: 400 };
    const level: LevelJson = {
      entities: [
        { class: 'Environment', config: { background: 0x334455 } },
        {
          class: 'Backdrop',
          name: 'Horizon',
          config: {
            scale: 0.0625,
            anchor: { x: 1, y: 2, z: 0 },
            children: [
              { class: 'Environment', config: { fog } },
              { class: 'Light', position: { x: 50, y: 30, z: 80 }, config: { type: 'DIRECTIONAL', intensity: 3 } },
              { class: 'Marker', name: 'Beacon' },
            ],
          },
        },
      ],
    };
    const group = await world.loader.loadLevel(level, 'L');
    const backdrop = group.getChildEntityByName<Backdrop3dEntity>('Horizon');
    expect(backdrop).toBeInstanceOf(Backdrop3dEntity);
    expect(backdrop.scale).toBe(0.0625);
    expect(backdrop.anchor).toEqual({ x: 1, y: 2, z: 0 });
    const own = backdrop.ownedScene as unknown as MockScene;
    expect(own).toBe(scene.backdropScenes[0]);
    expect(own.init).toHaveBeenCalled();

    // the level's sky stays on the world scene, the backdrop's fog on its own
    expect(scene.environment.background).toBe(0x334455);
    expect(scene.environment.fog).toBeNull();
    expect(own.environment.fog).toEqual(fog);

    const light = backdrop.children.find(c => c instanceof Light3dEntity) as Light3dEntity;
    expect(light.name).toBe('Horizon__Light_1');
    expect(own.attached.has(light.light)).toBe(true);
    expect(scene.attached.has(light.light)).toBe(false);

    expect(built).toEqual([{ spawnedParent: backdrop, world }]);
    expect(world.getEntityByName('Beacon').parent).toBe(backdrop);

    world.removeEntity(group, true);
    expect(own.dispose).toHaveBeenCalled();
    expect(world.backdrops).toEqual([]);
    expect(scene.environment.background).toBeNull();
  });

  it('collects the assets of its children for the level preload', () => {
    const refs = world.loader.collectLevelAssets({
      entities: [
        {
          class: 'Backdrop',
          name: 'Horizon',
          config: { children: [{ class: 'Glb', config: { path: 'assets/mountain_ring' } }] },
        },
      ],
    });
    expect(refs).toEqual([expect.objectContaining({ kind: 'ggGlb', url: 'assets/mountain_ring' })]);
  });

  it('a child a backdrop refuses fails the level and leaves nothing behind', async () => {
    class Body extends Entity3d {
      static readonly entityTypeName: string = 'Body';
    }
    world.loader.registerClass('Body', () => new Body({ objectBody: mock3DBody() }));
    await expect(
      world.loader.loadLevel(
        { entities: [{ class: 'Backdrop', name: 'Horizon', config: { children: [{ class: 'Body' }] } }] },
        'L',
      ),
    ).rejects.toThrow(/physics/);
    expect(scene.backdropScenes[0].dispose).toHaveBeenCalled();
    expect(world.children).toEqual([]);
  });

  it('serializes back to its spawn record', async () => {
    const entityJson = { class: 'Backdrop', name: 'Horizon', config: { scale: 0.5, children: [] } };
    const group = await world.loader.loadLevel({ entities: [entityJson] }, 'L');
    expect(world.loader.serializeEntity(group.getChildEntityByName('Horizon'))).toEqual(
      expect.objectContaining({ class: 'Backdrop', config: entityJson.config }),
    );
  });
});
