import {
  CachingStrategy,
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
  Trigger3dEntity,
} from '@gg-web-engine/core';
import { ThreeGgWorld, ThreeSceneComponent, ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { AmbientLight, DirectionalLight, Mesh, PointLight } from 'three';
import { Rapier3dWorldComponent } from '@gg-web-engine/rapier3d';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

const ASSETS_BASE = 'https://gg-web-demos.guraklgames.com/assets';

const ROOM_SIZE = 12;
const WALL_HEIGHT = 4;
const WALL_THICKNESS = 0.5;
const PEDESTAL_HEIGHT = 0.9;
// Where a freshly-spawned radio comes to rest - the pedestal's own top surface, dead-center in the room.
const RADIO_SPAWN_POSITION = { x: 0, y: 0, z: PEDESTAL_HEIGHT };

// Tucked in a back corner, well clear of both the pedestal and the player's spawn point. Built as
// a walled well with an actual open hole in the middle (four thin walls ringing it, floored by the
// room's own floor primitive) rather than a solid block, so only something that's actually been
// thrown/dropped down into the hole ever reaches the `IncineratorMouth` trigger sitting at the
// bottom of it - see that trigger's own comment below for why this matters.
const INCINERATOR_X = 4.3;
const INCINERATOR_Y = 4.3;
const INCINERATOR_OUTER = 1.6;
const INCINERATOR_WALL = 0.25;
const INCINERATOR_INNER = INCINERATOR_OUTER - INCINERATOR_WALL * 2;
const INCINERATOR_HEIGHT = 1.0;

// Aperture Science test-chamber palette: bright, sterile off-white panels, a checkered floor and
// the signature orange floor stripe - approximated with plain colored primitives (no textures).
const COLOR_WALL = 0xe9e9e2;
const COLOR_CEILING = 0xf2f2ec;
const COLOR_FLOOR_TILE_A = 0xc7c7bf;
const COLOR_FLOOR_TILE_B = 0xb7b7ad;
const COLOR_TRIM = 0xaeaea4;
const COLOR_STRIPE = 0xff6a13;
const COLOR_PEDESTAL = 0x9a9a92;
const COLOR_INCINERATOR = 0x2e2e2b;
const COLOR_INCINERATOR_GLOW = 0xff3300;

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
      config: {
        dimensions: { x: ROOM_SIZE, y: ROOM_SIZE, z: 1 },
        material: { color: COLOR_CEILING },
        body: { dynamic: false },
      },
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
      config: {
        radius: 0.5,
        height: PEDESTAL_HEIGHT,
        material: { color: COLOR_PEDESTAL, shading: 'phong' },
        body: { dynamic: false },
      },
    },
    // The incinerator's four walls, forming a hollow square ring around an actual open hole (see
    // `INCINERATOR_X`'s own comment above) - same "overlap at the corners" trick the room's own
    // North/South/East/West walls use, just scaled down.
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'IncineratorWallNorth',
      position: {
        x: INCINERATOR_X,
        y: INCINERATOR_Y + INCINERATOR_INNER / 2 + INCINERATOR_WALL / 2,
        z: INCINERATOR_HEIGHT / 2,
      },
      config: {
        dimensions: { x: INCINERATOR_OUTER, y: INCINERATOR_WALL, z: INCINERATOR_HEIGHT },
        material: { color: COLOR_INCINERATOR, shading: 'phong' },
        body: { dynamic: false },
      },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'IncineratorWallSouth',
      position: {
        x: INCINERATOR_X,
        y: INCINERATOR_Y - INCINERATOR_INNER / 2 - INCINERATOR_WALL / 2,
        z: INCINERATOR_HEIGHT / 2,
      },
      config: {
        dimensions: { x: INCINERATOR_OUTER, y: INCINERATOR_WALL, z: INCINERATOR_HEIGHT },
        material: { color: COLOR_INCINERATOR, shading: 'phong' },
        body: { dynamic: false },
      },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'IncineratorWallEast',
      position: {
        x: INCINERATOR_X + INCINERATOR_INNER / 2 + INCINERATOR_WALL / 2,
        y: INCINERATOR_Y,
        z: INCINERATOR_HEIGHT / 2,
      },
      config: {
        dimensions: { x: INCINERATOR_WALL, y: INCINERATOR_OUTER, z: INCINERATOR_HEIGHT },
        material: { color: COLOR_INCINERATOR, shading: 'phong' },
        body: { dynamic: false },
      },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'IncineratorWallWest',
      position: {
        x: INCINERATOR_X - INCINERATOR_INNER / 2 - INCINERATOR_WALL / 2,
        y: INCINERATOR_Y,
        z: INCINERATOR_HEIGHT / 2,
      },
      config: {
        dimensions: { x: INCINERATOR_WALL, y: INCINERATOR_OUTER, z: INCINERATOR_HEIGHT },
        material: { color: COLOR_INCINERATOR, shading: 'phong' },
        body: { dynamic: false },
      },
    },
    // Fills only the bottom of the hole, not the whole shaft up to the rim - so something has to
    // actually fall (most of the way) down into it, not just dip below rim height, before it's
    // "burned". Merely flying/being carried past at head height, well above the walls, never
    // touches this either way: the walls physically block a casual walk-through at ground level
    // too, so reaching it takes a deliberate throw or drop.
    {
      class: 'Trigger',
      name: 'IncineratorMouth',
      position: { x: INCINERATOR_X, y: INCINERATOR_Y, z: INCINERATOR_HEIGHT * 0.25 },
      config: { dimensions: { x: INCINERATOR_INNER * 0.9, y: INCINERATOR_INNER * 0.9, z: INCINERATOR_HEIGHT * 0.5 } },
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
  physicsWorld: new Rapier3dWorldComponent(),
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
  // a warm glow shining down into the incinerator's hole - the `IncineratorMouth` trigger
  // subscription below flashes it brighter for a moment whenever something actually gets burned.
  const incineratorGlow = new PointLight(COLOR_INCINERATOR_GLOW, 1.5, 5);
  incineratorGlow.position.set(INCINERATOR_X, INCINERATOR_Y, INCINERATOR_HEIGHT + 0.3);
  world.visualScene.nativeScene?.add(incineratorGlow);

  const levelGroup = await world.loader.loadLevel(level);
  for (const item of levelGroup.children as { object3D?: { nativeMesh: Mesh } }[]) {
    item.object3D?.nativeMesh.traverse(obj => {
      obj.castShadow = true;
      obj.receiveShadow = true;
    });
  }

  // Decorative-only geometry from here on (checkered floor tiles, wall trim, the orange floor
  // stripe, the embers at the bottom of the incinerator's hole): plain `Entity3d`s with no
  // `objectBody` - the room shell above already provides the real floor/wall/incinerator colliders,
  // so these are visual overlays only, not extra physics bodies.
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

  // A glowing panel hovering partway up the incinerator's hole, roughly level with the
  // `IncineratorMouth` trigger declared in the level above - not flush with the floor, so it stays
  // clearly visible looking down into the shaft rather than getting lost among the floor tiles.
  const incineratorEmbers = new Entity3d({
    object3D: world.visualScene!.factory.createBox(
      { x: INCINERATOR_INNER * 0.9, y: INCINERATOR_INNER * 0.9, z: 0.04 },
      { shading: 'unlit', color: COLOR_INCINERATOR_GLOW },
    ),
  });
  incineratorEmbers.position = { x: INCINERATOR_X, y: INCINERATOR_Y, z: INCINERATOR_HEIGHT * 0.25 };
  world.addEntity(incineratorEmbers);

  // The one dynamic, grabbable prop: a plain visual GLB with no baked-in physics body (see the
  // asset's own .meta - "rigidBodies": []), so its collider is built by hand here from the loaded
  // mesh's own bounding box, as a `COMPOUND` shape offset by that box's center - not necessarily
  // centered on the GLB's own local origin. See `Grabbable3dEntity`'s doc for why carrying drives
  // this body's velocity rather than teleporting it.
  //
  // Wrapped in a function, not just a one-off `const`, because the radio can be thrown into the
  // incinerator (see the `IncineratorMouth` trigger subscription below) - when that happens the
  // burned instance is disposed and this is called again to put a fresh one back on the pedestal.
  // `CachingStrategy.Entities` caches the parsed GLB/meta after the first load, so every respawn
  // just clones the cached mesh/bounds instead of re-fetching or re-parsing the asset.
  async function spawnRadio(): Promise<Grabbable3dEntity> {
    const radioLoad = await world.loader.loadGgGlb(`${ASSETS_BASE}/fun_props/portal_radio`, {
      loadProps: false,
      cachingStrategy: CachingStrategy.Entities,
    });
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
    const newRadio = new Grabbable3dEntity(
      { object3D: radioObject, objectBody: radioBody },
      {
        followStrength: 14,
        maxFollowSpeed: 18,
      },
    );
    newRadio.position = {
      x: RADIO_SPAWN_POSITION.x - center.x,
      y: RADIO_SPAWN_POSITION.y - center.y,
      z: RADIO_SPAWN_POSITION.z - bounds.min.z,
    };
    world.addEntity(newRadio);
    return newRadio;
  }
  let radio = await spawnRadio();

  const cameraEntity = levelGroup.getChildEntityByName<Camera3dEntity<ThreeVisualTypeDocRepo>>('MainCamera');
  const renderer = world.addRenderer(cameraEntity.camera, canvas);

  const player = levelGroup.getChildEntityByName<CharacterController3dEntity>('Player');
  const playerController = new PlayerCharacterController(world.keyboardInput, player, renderer, {
    mouseOptions: { canvas },
    ignoreMouseUnlessPointerLocked: true,
  });
  world.addEntity(playerController);

  // Reuses the player controller's own `keyboard`/`mouseInput`/`camera` rather than constructing new
  // input instances - see `ObjectGrabController`'s doc. `player` is passed as the holder so the radio
  // is genuinely excluded from the player's own collision while held (via
  // `player.characterController.ignoredBodies`, wired up automatically - no collision-group setup
  // needed here) and the hold point stays clamped away from the player's own capsule.
  const grabController = new ObjectGrabController(world.keyboardInput, playerController.mouseInput, renderer, player);
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

  // Throw (or drop) the radio into the incinerator and it's gone for good - a fresh one appears
  // back on the pedestal a moment later. `Grabbable3dEntity.onRemoved` already releases the object
  // from whoever's holding it before disposal, so this is safe to call even mid-carry.
  const incineratorMouth = levelGroup.getChildEntityByName<Trigger3dEntity>('IncineratorMouth');
  incineratorMouth.onEntityEntered.subscribe(entity => {
    if (!(entity instanceof Grabbable3dEntity)) {
      return;
    }
    world.removeEntity(entity, true);
    incineratorGlow.intensity = 6;
    setTimeout(() => (incineratorGlow.intensity = 1.5), 200);
    spawnRadio().then(newRadio => (radio = newRadio));
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
