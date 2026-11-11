import {
  Backdrop3dEntity,
  CharacterController3dEntity,
  DisplayObject3dOpts,
  Entity3d,
  EntityJson,
  Frame3d,
  Gg3dWorld,
  GgStatic,
  LevelJson,
  LoadingScreen,
  PlayerCharacterController,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  Shape3DDescriptor,
} from '@gg-web-engine/core';
import { MobileControls } from '@gg-web-engine/mobile-controls';
import { ThreeGgWorld, ThreeSceneComponent } from '@gg-web-engine/three';
import { createPhysicsWorld } from './backends';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

/**
 * A display-only primitive: a mesh without a physics body. Backdrop content can't have bodies
 * (it is drawn at another scale), and the built-in "Primitive" class always builds one when the
 * world has physics - so the scenery of the backdrops uses this app-registered class instead.
 */
type ScenerySettings = {
  geometry: Shape3DDescriptor;
  // no textures in this demo
  material?: Omit<DisplayObject3dOpts<unknown>, 'diffuse'>;
  position?: Point3;
  rotation?: Point4;
};

const scenery = (geometry: Shape3DDescriptor, position: Point3, color: number): EntityJson => ({
  class: 'Scenery',
  position,
  config: { geometry, material: { color, shading: 'standart' } },
});

// a cone standing on z = 0 (cones and cylinders are centered on their position, axis along Z)
const peak = (x: number, y: number, radius: number, height: number, color: number) =>
  scenery({ shape: 'CONE', radius, height }, { x, y, z: height / 2 }, color);

const sky = { type: 'PROCEDURAL' as const, timeOfDay: 15.5, haze: 0.35, clouds: { coverage: 0.35 } };
const haze = 0xc4d6e6;

// The ring of mountains on the horizon, at 1/256 scale: one backdrop unit is 256 m, so the ring at
// radius 40 is about 10 km away and its peaks rise 1-1.5 km.
const mountains: EntityJson[] = [];
for (let i = 0; i < 18; i++) {
  const angle = (i / 18) * Math.PI * 2 + Math.sin(i * 7.3) * 0.12;
  const distance = 40 + Math.sin(i * 3.1) * 4;
  const height = 4 + Math.abs(Math.sin(i * 1.7)) * 2;
  const radius = 6 + Math.abs(Math.cos(i * 2.3)) * 3;
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance;
  mountains.push(peak(x, y, radius, height, 0x5d6b5a));
  // a snow cap: the top quarter of the same cone, slightly larger so it covers the rock
  mountains.push(
    scenery({ shape: 'CONE', radius: radius * 0.27, height: height * 0.26 }, { x, y, z: height * 0.88 }, 0xf2f4f7),
  );
}

// The coastline around the island, at 1/16 scale: one backdrop unit is 16 m.
const coast: EntityJson[] = [
  // the sea out to the horizon (the island's own water ends 120 m out)
  scenery({ shape: 'BOX', dimensions: { x: 4000, y: 4000, z: 0.01 } }, { x: 0, y: 0, z: -0.3 / 16 - 0.005 }, 0x2c6e8f),
  // three islands, each a sand disc with a green hill
  scenery({ shape: 'CYLINDER', radius: 6, height: 0.2 }, { x: 22, y: 9, z: 0 }, 0xd8c9a0),
  peak(22, 9, 5, 3.5, 0x4f7a43),
  scenery({ shape: 'CYLINDER', radius: 4, height: 0.2 }, { x: -18, y: 20, z: 0 }, 0xd8c9a0),
  peak(-18, 20, 3, 2, 0x5b8a4b),
  scenery({ shape: 'CYLINDER', radius: 9, height: 0.2 }, { x: -6, y: -34, z: 0 }, 0xd8c9a0),
  peak(-6, -34, 8, 6, 0x48703d),
  // a lighthouse on the small island: about 50 m tall
  scenery({ shape: 'CYLINDER', radius: 0.25, height: 3 }, { x: -16, y: 18.5, z: 1.5 }, 0xf4f1ea),
  scenery({ shape: 'CONE', radius: 0.4, height: 0.6 }, { x: -16, y: 18.5, z: 3.3 }, 0xb3302a),
];
// a harbour town on the big island
for (let i = 0; i < 9; i++) {
  const x = -2 + (i % 3) * 0.9;
  const y = -27 + Math.floor(i / 3) * 0.9;
  const height = 0.4 + ((i * 37) % 5) * 0.15;
  coast.push(scenery({ shape: 'BOX', dimensions: { x: 0.6, y: 0.6, z: height } }, { x, y, z: height / 2 }, 0xe7ddd0));
}

const tree = (x: number, y: number): EntityJson[] => [
  {
    class: 'Primitive',
    shape: 'CYLINDER',
    position: { x, y, z: 1.5 },
    config: {
      radius: 0.2,
      height: 3,
      material: { color: 0x7a5a3a, shading: 'standart' },
      body: { bodyType: 'static' },
    },
  },
  {
    class: 'Primitive',
    shape: 'SPHERE',
    position: { x, y, z: 3.3 },
    config: { radius: 1.2, material: { color: 0x3d7a3a, shading: 'standart' }, body: { bodyType: 'static' } },
  },
];

const level: LevelJson = {
  entities: [
    // the one sky of the world: drawn behind the farthest backdrop
    { class: 'Environment', config: { background: sky, environmentMap: sky } },
    { class: 'Light', config: { type: 'HEMISPHERE', intensity: 1 } },
    {
      class: 'Light',
      position: { x: 30, y: -20, z: 40 },
      config: {
        type: 'DIRECTIONAL',
        intensity: 2.5,
        target: Pnt3.O,
        castShadow: true,
        shadow: { mapSize: 2048, area: 50, far: 150 },
      },
    },
    // the playable island, in meters: a sand disc on a shallow sea floor, a pier and a few trees
    {
      class: 'Primitive',
      shape: 'BOX',
      position: { x: 0, y: 0, z: -1.5 },
      config: {
        dimensions: { x: 240, y: 240, z: 1 },
        material: { color: 0x9c8b66, shading: 'standart' },
        body: { bodyType: 'static' },
      },
    },
    {
      class: 'Primitive',
      shape: 'CYLINDER',
      position: { x: 0, y: 0, z: -0.5 },
      config: {
        radius: 18,
        height: 1,
        material: { color: 0xe3d3a5, shading: 'standart' },
        body: { bodyType: 'static' },
      },
    },
    {
      class: 'Primitive',
      shape: 'BOX',
      position: { x: 0, y: -24, z: 0.1 },
      config: {
        dimensions: { x: 2.5, y: 14, z: 0.3 },
        material: { color: 0x8a6a48, shading: 'standart' },
        body: { bodyType: 'static' },
      },
    },
    ...tree(5, 4),
    ...tree(-7, 2),
    ...tree(2, -9),
    ...tree(-3, 11),
    // the water around it, out to 120 m: display only, the player wades through it
    {
      class: 'Scenery',
      position: { x: 0, y: 0, z: -0.3 },
      config: {
        geometry: { shape: 'BOX', dimensions: { x: 240, y: 240, z: 0.01 } },
        material: { color: 0x2c6e8f, shading: 'standart', opacity: 0.85 },
      },
    },
    {
      class: 'Player',
      name: 'Player',
      position: { x: 0, y: -20, z: 1.5 },
      config: { radius: 0.4, centersDistance: 1.0, walkSpeed: 4, runSpeedMultiplier: 2, jumpSpeed: 4 },
    },
    // Backdrops, farthest first. Everything inside one is in its own units: scale it by 1/scale
    // for meters. Each has its own fog - in its own units too - which is what makes the far ring
    // bluer than the coast. Neither has a sky of its own: the Environment above is the world's.
    {
      class: 'Backdrop',
      name: 'Mountains',
      config: {
        scale: 1 / 256,
        children: [
          { class: 'Environment', config: { fog: { type: 'LINEAR', color: haze, near: 10, far: 75 } } },
          { class: 'Light', config: { type: 'HEMISPHERE', intensity: 1.2 } },
          {
            class: 'Light',
            position: { x: 30, y: -20, z: 40 },
            config: { type: 'DIRECTIONAL', intensity: 2, target: Pnt3.O },
          },
          ...mountains,
        ],
      },
    },
    {
      class: 'Backdrop',
      name: 'Coast',
      config: {
        scale: 1 / 16,
        children: [
          { class: 'Environment', config: { fog: { type: 'LINEAR', color: haze, near: 15, far: 180 } } },
          { class: 'Light', config: { type: 'HEMISPHERE', intensity: 1 } },
          {
            class: 'Light',
            position: { x: 30, y: -20, z: 40 },
            config: { type: 'DIRECTIONAL', intensity: 2.5, target: Pnt3.O },
          },
          ...coast,
        ],
      },
    },
  ],
};

const loading = LoadingScreen.show();
const world: ThreeGgWorld = new Gg3dWorld({
  visualScene: new ThreeSceneComponent(),
  physicsWorld: await createPhysicsWorld(),
});
await world.init();

world.loader.registerClass('Scenery', (w: ThreeGgWorld, settings: ScenerySettings) => {
  const entity = new Entity3d({
    object3D: w.visualScene.factory.createPrimitive(settings.geometry, settings.material),
  });
  entity.position = settings.position ?? Pnt3.O;
  entity.rotation = settings.rotation ?? Qtrn.O;
  return entity;
});

const levelGroup = await world.loader.loadLevel(level, 'Island', { onProgress: p => loading.setProgress(p) });
for (const item of levelGroup.children) {
  if (item instanceof Entity3d && item.object3D) {
    item.object3D.castShadow = true;
    item.object3D.receiveShadow = true;
  }
}

const canvas = document.getElementById('gg')! as HTMLCanvasElement;
const renderer = world.addRenderer(
  world.visualScene.factory.createPerspectiveCamera({ fov: 70, frustrum: { near: 0.1, far: 500 } }),
  canvas,
);
const player = levelGroup.getChildEntityByName<CharacterController3dEntity>('Player');
// look along the pier towards the island
renderer.rotation = Qtrn.lookAt({ x: 0, y: -20, z: 1.5 }, { x: 0, y: 0, z: 1.5 }, Pnt3.Z);
world.addEntity(
  new PlayerCharacterController(world.keyboardInput, player, renderer, {
    mouseOptions: { canvas },
    ignoreMouseUnlessPointerLocked: true,
  }),
);
// on-screen stick and buttons on phones and tablets; does nothing on a desktop
world.addEntity(new MobileControls());

// the panel
const backdrops: Backdrop3dEntity[] = [
  levelGroup.getChildEntityByName<Backdrop3dEntity>('Mountains'),
  levelGroup.getChildEntityByName<Backdrop3dEntity>('Coast'),
];
document.getElementById('backdrops')!.addEventListener('change', e => {
  // a backdrop taken out of the world is not drawn; adding it back draws it again
  for (const backdrop of backdrops) {
    if ((e.target as HTMLInputElement).checked) {
      levelGroup.addChildren(backdrop);
    } else {
      levelGroup.removeChildren([backdrop]);
    }
  }
});
document.getElementById('coast-scale')!.addEventListener('change', e => {
  // live: the coast moves closer (larger scale) or farther away; at 0 it never moves at all
  backdrops[1].scale = +(e.target as HTMLSelectElement).value;
});
const frameOutput = document.getElementById('frame')!;
const showFrame = () => {
  const { position, yaw } = world.frame;
  frameOutput.textContent = `frame: (${position.x.toFixed(0)}, ${position.y.toFixed(0)}), yaw ${yaw.toFixed(2)}`;
};
showFrame();
// Moves the whole world into another frame: the island, the player and the camera get new local
// coordinates, the sky turns with the local axes. The backdrops map the camera through global
// coordinates, so nothing on screen jumps.
document.getElementById('switch-frame')!.addEventListener('click', () => {
  world.switchFrame(
    new Frame3d({ x: (Math.random() - 0.5) * 2000, y: (Math.random() - 0.5) * 2000, z: 0 }, (Math.random() - 0.5) * 6),
  );
  showFrame();
});

world.start();
loading.hide();
