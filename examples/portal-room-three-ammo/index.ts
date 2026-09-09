import {
  Camera3dEntity,
  CharacterController3dEntity,
  Entity3d,
  Gg3dWorld,
  GgStatic,
  Grabbable3dEntity,
  LevelJson,
  ObjectGrabController,
  Pnt3,
  PlayerCharacterController,
} from '@gg-web-engine/core';
import { ThreeGgWorld, ThreeSceneComponent, ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { AmbientLight, DirectionalLight, Mesh, PointLight } from 'three';
import { AmmoWorldComponent } from '@gg-web-engine/ammo';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

const ASSETS_BASE = 'https://gg-web-demos.guraklgames.com/assets';

const ROOM_SIZE = 12;
const WALL_HEIGHT = 4;
const WALL_THICKNESS = 0.5;
const PEDESTAL_HEIGHT = 0.9;

// Aperture Science test-chamber palette: bright, sterile off-white panels, a checkered floor and
// the signature orange floor stripe - approximated with plain colored primitives (no textures).
const COLOR_WALL = 0xe9e9e2;
const COLOR_CEILING = 0xf2f2ec;
const COLOR_FLOOR_TILE_A = 0xc7c7bf;
const COLOR_FLOOR_TILE_B = 0xb7b7ad;
const COLOR_TRIM = 0xaeaea4;
const COLOR_STRIPE = 0xff6a13;
const COLOR_PEDESTAL = 0x9a9a92;

const level: LevelJson = {
  entities: [
    {
      class: 'Camera',
      name: 'MainCamera',
      position: { x: 0, y: -5, z: 4 },
      config: { frustrum: { near: 0.05, far: 1000 } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'Floor',
      position: { x: 0, y: 0, z: -0.5 },
      config: {
        dimensions: { x: ROOM_SIZE, y: ROOM_SIZE, z: 1 },
        material: { color: COLOR_WALL },
        body: { dynamic: false, friction: 1.2 },
      },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'Ceiling',
      position: { x: 0, y: 0, z: WALL_HEIGHT + 0.5 },
      config: { dimensions: { x: ROOM_SIZE, y: ROOM_SIZE, z: 1 }, material: { color: COLOR_CEILING }, body: { dynamic: false } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'CeilingLightFixture',
      position: { x: 0, y: 0, z: WALL_HEIGHT - 0.02 },
      config: {
        dimensions: { x: ROOM_SIZE * 0.5, y: ROOM_SIZE * 0.2, z: 0.02 },
        material: { shading: 'unlit', color: 0xffffff },
        body: { dynamic: false },
      },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'WallNorth',
      position: { x: 0, y: ROOM_SIZE / 2, z: WALL_HEIGHT / 2 },
      config: {
        dimensions: { x: ROOM_SIZE + WALL_THICKNESS, y: WALL_THICKNESS, z: WALL_HEIGHT },
        material: { color: COLOR_WALL },
        body: { dynamic: false },
      },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'WallSouth',
      position: { x: 0, y: -ROOM_SIZE / 2, z: WALL_HEIGHT / 2 },
      config: {
        dimensions: { x: ROOM_SIZE + WALL_THICKNESS, y: WALL_THICKNESS, z: WALL_HEIGHT },
        material: { color: COLOR_WALL },
        body: { dynamic: false },
      },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'WallEast',
      position: { x: ROOM_SIZE / 2, y: 0, z: WALL_HEIGHT / 2 },
      config: {
        dimensions: { x: WALL_THICKNESS, y: ROOM_SIZE + WALL_THICKNESS, z: WALL_HEIGHT },
        material: { color: COLOR_WALL },
        body: { dynamic: false },
      },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'WallWest',
      position: { x: -ROOM_SIZE / 2, y: 0, z: WALL_HEIGHT / 2 },
      config: {
        dimensions: { x: WALL_THICKNESS, y: ROOM_SIZE + WALL_THICKNESS, z: WALL_HEIGHT },
        material: { color: COLOR_WALL },
        body: { dynamic: false },
      },
    },
    {
      class: 'Primitive',
      shape: 'CYLINDER',
      name: 'Pedestal',
      position: { x: 0, y: 0, z: PEDESTAL_HEIGHT / 2 },
      config: { radius: 0.5, height: PEDESTAL_HEIGHT, material: { color: COLOR_PEDESTAL, shading: 'phong' }, body: { dynamic: false } },
    },
    {
      class: 'Player',
      name: 'Player',
      position: { x: 0, y: -4, z: 1.5 },
      config: {
        radius: 0.4,
        centersDistance: 1.0,
        walkSpeed: 4,
        runSpeedMultiplier: 1.8,
        jumpSpeed: 4,
        display: { color: 0x3388ff },
      },
    },
  ],
};

const world: ThreeGgWorld = new Gg3dWorld({
  visualScene: new ThreeSceneComponent(),
  physicsWorld: new AmmoWorldComponent(),
});
world.init().then(async () => {
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;

  world.visualScene.nativeScene?.add(new AmbientLight(0xffffff, 0.8));
  const dirLight = new DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(10, -10, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  const d = 10;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  dirLight.shadow.camera.far = 60;
  world.visualScene.nativeScene?.add(dirLight);
  // a soft glow under the ceiling light fixture, on top of the directional key light above
  const ceilingGlow = new PointLight(0xffffff, 1.2, 12);
  ceilingGlow.position.set(0, 0, WALL_HEIGHT - 0.3);
  world.visualScene.nativeScene?.add(ceilingGlow);

  const levelGroup = await world.loader.loadLevel(level);
  for (const item of levelGroup.children as { object3D?: { nativeMesh: Mesh } }[]) {
    item.object3D?.nativeMesh.traverse(obj => {
      obj.castShadow = true;
      obj.receiveShadow = true;
    });
  }

  // Decorative-only geometry from here on (checkered floor tiles, wall trim, the orange floor
  // stripe): plain `Entity3d`s with no `objectBody` - the room shell above already provides the
  // real floor/wall colliders, so these are visual overlays only, not extra physics bodies.
  const TILE_SIZE = 1.5;
  const tilesPerSide = Math.round(ROOM_SIZE / TILE_SIZE);
  for (let i = 0; i < tilesPerSide; i++) {
    for (let j = 0; j < tilesPerSide; j++) {
      const color = (i + j) % 2 === 0 ? COLOR_FLOOR_TILE_A : COLOR_FLOOR_TILE_B;
      const tileMesh = world.visualScene!.factory.createBox(
        { x: TILE_SIZE - 0.05, y: TILE_SIZE - 0.05, z: 0.02 },
        { color, shading: 'phong', receiveShadow: true },
      );
      const tile = new Entity3d({ object3D: tileMesh });
      tile.position = {
        x: -ROOM_SIZE / 2 + TILE_SIZE * (i + 0.5),
        y: -ROOM_SIZE / 2 + TILE_SIZE * (j + 0.5),
        z: 0.02,
      };
      world.addEntity(tile);
    }
  }

  type WallAxis = 'x' | 'y';
  const wallDefs: { axis: WallAxis; sign: 1 | -1 }[] = [
    { axis: 'x', sign: 1 },
    { axis: 'x', sign: -1 },
    { axis: 'y', sign: 1 },
    { axis: 'y', sign: -1 },
  ];
  const innerOffset = ROOM_SIZE / 2 - WALL_THICKNESS / 2 - 0.03;
  const wallPos = (axis: WallAxis, sign: 1 | -1, offset: number, height: number) =>
    axis === 'x' ? { x: 0, y: sign * offset, z: height } : { x: sign * offset, y: 0, z: height };
  for (const { axis, sign } of wallDefs) {
    const trimDims = axis === 'x' ? { x: ROOM_SIZE, y: 0.06, z: 0.3 } : { x: 0.06, y: ROOM_SIZE, z: 0.3 };
    const trim = new Entity3d({ object3D: world.visualScene!.factory.createBox(trimDims, { color: COLOR_TRIM }) });
    trim.position = wallPos(axis, sign, innerOffset, 2.6);
    world.addEntity(trim);

    const stripeDims = axis === 'x' ? { x: ROOM_SIZE, y: 0.06, z: 0.15 } : { x: 0.06, y: ROOM_SIZE, z: 0.15 };
    const stripe = new Entity3d({
      object3D: world.visualScene!.factory.createBox(stripeDims, { shading: 'unlit', color: COLOR_STRIPE }),
    });
    stripe.position = wallPos(axis, sign, innerOffset, 0.12);
    world.addEntity(stripe);
  }

  // The one dynamic, grabbable prop: a plain visual GLB with no baked-in physics body (see the
  // asset's own .meta - "rigidBodies": []), so its collider is built by hand here from the loaded
  // mesh's own bounding box, as a `COMPOUND` shape offset by that box's center - not necessarily
  // centered on the GLB's own local origin. See `Grabbable3dEntity`'s doc for why carrying drives
  // this body's velocity rather than teleporting it.
  const radioLoad = await world.loader.loadGgGlb(`${ASSETS_BASE}/fun_props/portal_radio`, { loadProps: false });
  const radioObject = radioLoad.entities[0].object3D!;
  radioObject.nativeMesh.traverse(obj => {
    obj.castShadow = true;
    obj.receiveShadow = true;
  });
  const bounds = radioObject.getBoundings();
  const size = Pnt3.sub(bounds.max, bounds.min);
  const center = Pnt3.scalarMult(Pnt3.add(bounds.max, bounds.min), 0.5);
  const radioBody = world.physicsWorld!.factory.createRigidBody({
    shape: { shape: 'COMPOUND', children: [{ position: center, shape: { shape: 'BOX', dimensions: size } }] },
    body: { dynamic: true, mass: 3, friction: 0.8, restitution: 0.2 },
  });
  const radio = new Grabbable3dEntity({ object3D: radioObject, objectBody: radioBody }, {
    followStrength: 14,
    maxFollowSpeed: 18,
  });
  radio.position = { x: 0 - center.x, y: 0 - center.y, z: PEDESTAL_HEIGHT - bounds.min.z };
  world.addEntity(radio);

  const cameraEntity = levelGroup.getChildEntityByName<Camera3dEntity<ThreeVisualTypeDocRepo>>('MainCamera');
  const renderer = world.addRenderer(cameraEntity.camera, canvas);

  const player = levelGroup.getChildEntityByName<CharacterController3dEntity>('Player');
  const playerController = new PlayerCharacterController(world.keyboardInput, player, renderer, {
    mouseOptions: { canvas },
    ignoreMouseUnlessPointerLocked: true,
  });
  world.addEntity(playerController);

  // A dedicated collision group for the player, just for excluding it from a held prop below -
  // the character controller defaults to `ownCollisionGroups: 'all'` (every registered group, not
  // "the player's own"), so passing that straight through would leave a held prop colliding with
  // nothing at all (walls included) instead of just not jittering against the player - see
  // `ObjectGrabController`'s `holderCollisionGroups` doc. Keeping `mainCollisionGroup` alongside
  // it is load-bearing, not decoration: every static primitive in this level (floor/walls/pedestal)
  // was created with the default `interactWithCollisionGroups: [mainCollisionGroup]` (not `'all'`),
  // so a player whose *own* group no longer includes `mainCollisionGroup` at all stops colliding
  // with them entirely - Bullet's group filtering is bidirectional (each side's own group must be
  // included in the other side's mask), and a single-bit "narrower" own-group looks like a sane
  // idea right up until it silently drops the ground out from under the player (regression, found
  // live - the capsule clipped straight through the floor into the void).
  const playerCollisionGroup = world.physicsWorld!.registerCollisionGroup();
  player.characterController.ownCollisionGroups = [world.physicsWorld!.mainCollisionGroup, playerCollisionGroup];

  // Reuses the player controller's own `keyboard`/`mouseInput`/`camera` rather than constructing
  // new input instances - see `ObjectGrabController`'s doc.
  const grabController = new ObjectGrabController(world.keyboardInput, playerController.mouseInput, renderer, {
    holderCollisionGroups: [playerCollisionGroup],
  });
  world.addEntity(grabController);

  // A nice thematic touch matching the prop's name: play its paired sfx while it's being carried.
  const radioAudio = new Audio(`${ASSETS_BASE}/sfx/portal_radio.mp3`);
  radioAudio.loop = true;
  radioAudio.volume = 0.5;
  grabController.tick$.subscribe(() => {
    const held = grabController.heldObject === radio;
    if (held && radioAudio.paused) {
      radioAudio.play().catch(() => {});
    } else if (!held && !radioAudio.paused) {
      radioAudio.pause();
    }
  });

  world.start();

  playerController.mouseInput.isPointerLocked$.subscribe(locked => {
    if (locked) {
      world.resumeWorld();
    } else {
      world.pauseWorld();
    }
  });
});
