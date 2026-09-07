import {
  Camera3dEntity,
  CharacterController3dEntity,
  Gg3dWorld,
  GgStatic,
  LevelJson,
  PlayerCharacterController,
} from '@gg-web-engine/core';
import { ThreeGgWorld, ThreeSceneComponent, ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { AmbientLight, DirectionalLight, Mesh } from 'three';
import { AmmoWorldComponent } from '@gg-web-engine/ammo';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

// A self-contained room (floor + ceiling + 4 walls = 6 boxes) plus a few obstacles to exercise the
// player controller's core interactions: walking around solid shapes, jumping over a low barrier,
// and crouching under an overhead beam. Room spans x/y in [-10, 10]; the engine is Z-up throughout
// (see CLAUDE.md's "Non-obvious repo facts" - +Z is always up), and the player's local "forward" is
// +Y, matching the same axis paradigm RaycastVehicle3dEntity/GgCarEntity use.
const ROOM_SIZE = 20;
const WALL_HEIGHT = 4;

const level: LevelJson = {
  entities: [
    // the default near plane (1) clips geometry the player can get much closer than that to - the
    // first-person camera sits right at the ~0.4-radius capsule, and the third-person camera's own
    // collision pull-in (cameraCollisionMargin, default 0.2) can land it well inside a default near
    // plane too - so this close-quarters scene needs a much smaller near plane than the default.
    // A "Camera" entity's rotation defaults to identity if left unset, which - like any freshly
    // constructed three.js camera - looks down its own local -Z axis; since this world is Z-up
    // (see CLAUDE.md), that's straight down at the floor, not at the room. `rotation` here is a
    // 90° rotation about world +X, which turns that default "-Z forward" into "+Y forward" instead
    // - the room's own forward axis (the player spawns facing +Y too, see the "Player" entity
    // below) - so the very first frame already looks at the scene instead of the floor.
    {
      class: 'Camera',
      name: 'MainCamera',
      position: { x: 0, y: -8, z: 4 },
      rotation: { x: 0.7071067811865476, y: 0, z: 0, w: 0.7071067811865476 },
      config: { frustrum: { near: 0.05, far: 1000 } },
    },

    // room shell (6 boxes: floor, ceiling, 4 walls)
    // Floor friction bumped from the default 0.5 to 1.5 - at the default, a shoved CrateHeavy
    // (mass 50) coasted ~3.8m before friction actually stopped it (measured directly: push it,
    // then step the world in isolation until its velocity settles to ~0), which reads as "way too
    // easy to move" for something that heavy in a room this size. At 1.5 the same push settles it
    // in ~1.2m - still visibly slides, but noticeably resists being shoved around - while CrateLight
    // (mass 0.2) barely notices the difference (still travels several meters), since combined
    // sliding friction (~√(floor·body)) only grows sublinearly and a light box's own momentum is
    // small either way.
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'Floor',
      position: { x: 0, y: 0, z: -0.5 },
      config: {
        dimensions: { x: ROOM_SIZE, y: ROOM_SIZE, z: 1 },
        material: { color: 0x808080 },
        body: { dynamic: false, friction: 1.5 },
      },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'Ceiling',
      position: { x: 0, y: 0, z: WALL_HEIGHT + 0.5 },
      config: { dimensions: { x: ROOM_SIZE, y: ROOM_SIZE, z: 1 }, material: { color: 0xa0a0a0 }, body: { dynamic: false } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'WallNorth',
      position: { x: 0, y: ROOM_SIZE / 2, z: WALL_HEIGHT / 2 },
      config: {
        dimensions: { x: ROOM_SIZE + 0.5, y: 0.5, z: WALL_HEIGHT },
        material: { color: 0x909090 },
        body: { dynamic: false },
      },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'WallSouth',
      position: { x: 0, y: -ROOM_SIZE / 2, z: WALL_HEIGHT / 2 },
      config: {
        dimensions: { x: ROOM_SIZE + 0.5, y: 0.5, z: WALL_HEIGHT },
        material: { color: 0x909090 },
        body: { dynamic: false },
      },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'WallEast',
      position: { x: ROOM_SIZE / 2, y: 0, z: WALL_HEIGHT / 2 },
      config: {
        dimensions: { x: 0.5, y: ROOM_SIZE + 0.5, z: WALL_HEIGHT },
        material: { color: 0x909090 },
        body: { dynamic: false },
      },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'WallWest',
      position: { x: -ROOM_SIZE / 2, y: 0, z: WALL_HEIGHT / 2 },
      config: {
        dimensions: { x: 0.5, y: ROOM_SIZE + 0.5, z: WALL_HEIGHT },
        material: { color: 0x909090 },
        body: { dynamic: false },
      },
    },

    // a few solid shapes to walk around
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'Pillar',
      position: { x: 6, y: 0, z: 1 },
      config: { dimensions: { x: 2, y: 2, z: 2 }, material: { color: 0x606060 }, body: { dynamic: false } },
    },
    {
      class: 'Primitive',
      shape: 'SPHERE',
      name: 'Boulder',
      position: { x: 6, y: -4, z: 1 },
      config: { radius: 1, material: { color: 0xd62828 }, body: { dynamic: false } },
    },
    {
      class: 'Primitive',
      shape: 'CYLINDER',
      name: 'Column',
      position: { x: 6, y: 4, z: 1 },
      config: { radius: 0.8, height: 2, material: { color: 0x2a9d8f }, body: { dynamic: false } },
    },

    // a low barrier to jump over (jumpSpeed of 4 below still clears this comfortably)
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'JumpBarrier',
      position: { x: 0, y: -3, z: 0.3 },
      config: { dimensions: { x: 4, y: 0.6, z: 0.6 }, material: { color: 0xf4a261 }, body: { dynamic: false } },
    },

    // an overhead beam - its underside (z=1.6) clears a crouched capsule (~1.4 tall) but blocks a
    // standing one (~1.8 tall), forcing a crouch to pass under it
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'CrouchBeam',
      position: { x: 0, y: 3, z: 2.1 },
      config: { dimensions: { x: 4, y: 1.0, z: 1.0 }, material: { color: 0x8338ec }, body: { dynamic: false } },
    },

    // dynamic props to push around - same box shape/size and starting height so mass is the only
    // variable, laid out in a row within easy reach of the player's spawn point. "Primitive"'s
    // default body is already dynamic (mass: 1) - only `body.mass` is overridden per box. Walking
    // into one shoves it via `AmmoCharacterControllerComponent`'s `pushDynamicBody` (see
    // `CharacterController3dOptions.pushMass`, default 80 - roughly human mass): a light box gets
    // flung at close to the player's own speed, a heavy one barely budges, and either way it's
    // proportional to the actual mass difference, not just "on or off".
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'CrateLight',
      position: { x: -3, y: -5, z: 0.4 },
      config: { dimensions: { x: 0.8, y: 0.8, z: 0.8 }, material: { color: 0x90e0ef }, body: { mass: 0.2 } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'CrateMedium',
      position: { x: -3, y: -3, z: 0.4 },
      config: { dimensions: { x: 0.8, y: 0.8, z: 0.8 }, material: { color: 0x00b4d8 }, body: { mass: 5 } },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      name: 'CrateHeavy',
      position: { x: -3, y: -1, z: 0.4 },
      config: { dimensions: { x: 0.8, y: 0.8, z: 0.8 }, material: { color: 0x0077b6 }, body: { mass: 50 } },
    },

    // a couple of dynamic spheres too - rolling adds a second interaction shape to push around
    // alongside the crates' sliding/tipping
    {
      class: 'Primitive',
      shape: 'SPHERE',
      name: 'BallLight',
      position: { x: -5, y: -5, z: 0.4 },
      config: { radius: 0.4, material: { color: 0xffb703 }, body: { mass: 0.3 } },
    },
    {
      class: 'Primitive',
      shape: 'SPHERE',
      name: 'BallHeavy',
      position: { x: -5, y: -3, z: 0.5 },
      config: { radius: 0.5, material: { color: 0xfb8500 }, body: { mass: 20 } },
    },

    {
      class: 'Player',
      name: 'Player',
      position: { x: 0, y: -7, z: 1.5 },
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

  world.visualScene.nativeScene?.add(new AmbientLight(0xffffff, 0.6));
  const dirLight = new DirectionalLight(0xffffff, 1);
  dirLight.color.setHSL(0.1, 1, 0.95);
  dirLight.position.set(15, -15, 25);
  dirLight.lookAt(0, 0, 0);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  const d = 15;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  dirLight.shadow.camera.far = 100;
  world.visualScene.nativeScene?.add(dirLight);

  const levelGroup = await world.loader.loadLevel(level);

  // every "Primitive"/"Player" entity built above is an Entity3d wrapping a three.js mesh - enable
  // shadows on all of them (the "Camera" entity has no mesh, so it's skipped by the `object3D` check)
  for (const item of levelGroup.children as { object3D?: { nativeMesh: Mesh } }[]) {
    item.object3D?.nativeMesh.traverse(obj => {
      obj.castShadow = true;
      obj.receiveShadow = true;
    });
  }

  const cameraEntity = levelGroup.getChildEntityByName<Camera3dEntity<ThreeVisualTypeDocRepo>>('MainCamera');
  const renderer = world.addRenderer(cameraEntity.camera, canvas);

  // "Player" only builds the physics+visual capsule (see gg-engine-level-json skill) - the actual
  // keyboard/mouse input and first-/third-person camera wiring is built here, the same way
  // OrbitCameraController is wired around a "Camera" entity in glb-loader-three-ammo.
  const player = levelGroup.getChildEntityByName<CharacterController3dEntity>('Player');
  const controller = new PlayerCharacterController(world.keyboardInput, player, renderer, {
    mouseOptions: { canvas },
    // stray mouse movement over the page shouldn't spin the view before the canvas is even clicked
    ignoreMouseUnlessPointerLocked: true,
  });
  world.addEntity(controller);

  world.start();
});
