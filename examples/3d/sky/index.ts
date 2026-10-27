import {
  FreeCameraController,
  Gg3dWorld,
  Gg3dWorldWithPhysics,
  GgStatic,
  LoadingScreen,
  Pnt3,
  proceduralSkyBodies,
  ProceduralSky3dOpts,
  Qtrn,
} from '@gg-web-engine/core';
import { ThreeGgWorld, ThreeSceneComponent } from '@gg-web-engine/three';
import { createPhysicsWorld } from './backends';
import { createSkyPanel, SkySettings } from './sky-panel';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

const loading = LoadingScreen.show();
const world: Gg3dWorldWithPhysics<ThreeGgWorld> = new Gg3dWorld({
  visualScene: new ThreeSceneComponent(),
  physicsWorld: await createPhysicsWorld(),
});
await world.init();

const canvas = document.getElementById('gg')! as HTMLCanvasElement;
const renderer = world.addRenderer(
  world.visualScene.factory.createPerspectiveCamera({ fov: 60, frustrum: { near: 0.1, far: 2000 } }),
  canvas,
);
renderer.camera.position = { x: -22, y: -16, z: 5 };
renderer.camera.rotation = Qtrn.lookAt(renderer.camera.position, { x: 0, y: 0, z: 9 }, Pnt3.Z);

// the sun: a directional light that follows the sky's sun (or the moon at night)
const sunLight = world.addLight(
  { type: 'DIRECTIONAL', intensity: 3, castShadow: true, shadow: { mapSize: 2048, area: 60, near: 1, far: 200 } },
  { x: 0, y: 0, z: 80 },
  Pnt3.O,
);

// some scenery: 'standart' shading is lit by the sky when it is the environment map
world.addPrimitiveRigidBody(
  { shape: { shape: 'BOX', dimensions: { x: 400, y: 400, z: 1 } }, body: { bodyType: 'static', mass: 0 } },
  { x: 0, y: 0, z: -0.5 },
  Qtrn.O,
  { shading: 'standart', color: 0x8a8578, receiveShadow: true },
);
const pillars = [
  { x: 6, y: 4, h: 14, color: 0xd8d2c4 },
  { x: -4, y: 9, h: 8, color: 0xb04a3a },
  { x: 2, y: -8, h: 20, color: 0xe0e4ea },
  { x: 12, y: -3, h: 5, color: 0x3a6ea5 },
];
for (const p of pillars) {
  world.addPrimitiveRigidBody(
    { shape: { shape: 'BOX', dimensions: { x: 3, y: 3, z: p.h } }, body: { bodyType: 'static', mass: 0 } },
    { x: p.x, y: p.y, z: p.h / 2 },
    Qtrn.fromAngle(Pnt3.Z, p.x * 0.3),
    { shading: 'standart', color: p.color, castShadow: true, receiveShadow: true },
  );
}
for (let i = 0; i < 12; i++) {
  world.addPrimitiveRigidBody(
    { shape: { shape: 'SPHERE', radius: 1 }, body: { mass: 1, restitution: 0.4 } },
    { x: Math.cos(i) * 8, y: Math.sin(i) * 8, z: 3 + i * 2 },
    Qtrn.O,
    { shading: 'standart', color: world.visualScene.factory.randomColor(), castShadow: true, receiveShadow: true },
  );
}

// free camera: click the view to look around (mouse) and fly (WASD, Q/E down/up, Shift faster);
// Esc releases the mouse for the panel
const cameraController = new FreeCameraController(world.keyboardInput, renderer, {
  keymap: 'wasd',
  mouseOptions: { canvas, pointerLock: true },
  cameraLinearSpeed: 15,
  cameraRotationSensitivity: 0.8,
  ignoreMouseUnlessPointerLocked: true,
  ignoreKeyboardUnlessPointerLocked: true,
});
world.addEntity(cameraController);

function applySky(settings: SkySettings): void {
  const sky: ProceduralSky3dOpts = settings.sky;
  world.visualScene.setEnvironment({
    background: sky,
    environmentMap: settings.lightWithSky ? sky : null,
  });
  // aim the directional light from the sun by day, from the moon by night
  const { sunDirection, moonDirection, sunLight: daylight } = proceduralSkyBodies(sky);
  const moonUp = Math.max(0, Math.min(1, moonDirection.z * 5)) * (sky.moon ?? 1);
  const fromSun = daylight.intensity > 0.02 || moonUp === 0;
  const direction = fromSun ? sunDirection : moonDirection;
  sunLight.position = Pnt3.scalarMult(direction, 80);
  sunLight.rotation = Qtrn.lookAt(sunLight.position, Pnt3.O, Pnt3.Z);
  sunLight.light.color = fromSun ? daylight.color : 0xaabbdd;
  sunLight.light.intensity = fromSun ? daylight.intensity * 3 : moonUp * 0.25;
}

const panel = createSkyPanel(document.getElementById('panel')!, applySky);
world.worldClock.tick$.subscribe(([, delta]) => panel.tick(delta / 1000));

world.start();
loading.hide();
