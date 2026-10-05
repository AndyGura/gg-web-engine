import { FreeCameraController, Gg3dWorld, GgStatic, Pnt3, Qtrn, TypedGg3dWorld } from '@gg-web-engine/core';
import { ThreeDisplayObject3dOpts, ThreeGgWorld, ThreeSceneComponent } from '@gg-web-engine/three';
import { AmmoGgWorld, AmmoWorldComponent } from '@gg-web-engine/ammo';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

const world: TypedGg3dWorld<ThreeGgWorld, AmmoGgWorld> = new Gg3dWorld({
  visualScene: new ThreeSceneComponent(),
  physicsWorld: new AmmoWorldComponent(),
});
world.physicsWorld.maxSubSteps = 10;
world.physicsWorld.fixedTimeStep = undefined;

world.init().then(async () => {
  // init graphics
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;
  const renderer = world.addRenderer(
    world.visualScene.factory.createPerspectiveCamera({ fov: 45, frustrum: { near: 0.2, far: 1000 } }),
    canvas,
    { background: 0xBFD1E5 },
  );
  renderer.camera.position = { x: 40, y: 40, z: 25 };
  renderer.camera.rotation = Qtrn.lookAt(renderer.camera.position, { x: 0, y: 0, z: 10 }, Pnt3.Z);

  world.addLight(
    {
      type: 'DIRECTIONAL',
      intensity: 2.5,
      castShadow: true,
      shadow: { mapSize: 4096, area: 100, near: 2, far: 500 },
    },
    { x: 50, y: 50, z: 100 },
    Pnt3.O,
  );
  world.addLight({ type: 'AMBIENT', color: 0x606060 });

  // create objects
  const [groundTexture, brickTexture] = await Promise.all([
    world.visualScene.loader.loadTexture('https://gg-web-demos.guraklgames.com/assets/shooter/cement.jpg', {
      repeat: { x: 5, y: 5 },
    }),
    world.visualScene.loader.loadTexture('https://gg-web-demos.guraklgames.com/assets/shooter/brick.jpg'),
  ]);

  const brickColors = [0xB7B7B7, 0xAAAAAA, 0xA4A4A4, 0x979797, 0x949494, 0x909090];
  const brickMaterial = (): ThreeDisplayObject3dOpts => ({
    shading: 'phong',
    color: brickColors[Math.floor(Math.random() * brickColors.length)],
    diffuse: brickTexture,
    castShadow: true,
    receiveShadow: true,
  });
  const brickMass = 20;

  const createWall_X_axis = (startX: number, endX: number, y: number, zCount: number, shift: boolean) => {
    for (let z = 0; z <= zCount; z += 1.5) {
      let offsetX = shift ? 1.5 : 0;
      shift = !shift;
      for (let x = startX; x <= endX; x += 3) {
        world.addPrimitiveRigidBody({
          shape: { shape: 'BOX', dimensions: { x: 3, y: 1.5, z: 1.5 }, collisionMargin: 0.05 },
          body: { bodyType: 'dynamic', mass: brickMass },
        }, { x: x + offsetX, y, z: z + 0.75 }, Qtrn.O, brickMaterial());
      }
    }
  };

  const createWall_Y_axis = (startY: number, endY: number, x: number, zCount: number, shift: boolean) => {
    const quat = Qtrn.fromAngle(Pnt3.Z, Math.PI / 2);
    for (let z = 0; z <= zCount; z += 1.5) {
      let offsetY = shift ? 1.5 : 0;
      shift = !shift;
      for (let y = startY; y <= endY; y += 3) {
        const item = world.addPrimitiveRigidBody({
          shape: { shape: 'BOX', dimensions: { x: 3, y: 1.5, z: 1.5 }, collisionMargin: 0.05 },
          body: { bodyType: 'dynamic', mass: brickMass },
        }, { x, y: y + offsetY, z: z + 0.75 }, Qtrn.O, brickMaterial());
        item.rotation = quat;
      }
    }
  };
  createWall_X_axis(-8.25, 8.25, -9.75, 15, true);
  createWall_X_axis(-8.25, 8.25, 11.25, 15, false);
  createWall_Y_axis(-9, 9, -9, 15, false);
  createWall_Y_axis(-9, 9, 9, 15, true);

  world.addPrimitiveRigidBody(
    {
      shape: { shape: 'BOX', dimensions: { x: 100, y: 100, z: 1 }, collisionMargin: 0.05 },
      body: { bodyType: 'static', mass: 0 },
    },
    { x: 0, y: 0, z: -0.5 },
    Qtrn.O,
    { shading: 'phong', castShadow: true, receiveShadow: true, diffuse: groundTexture },
  );

  const cameraController = new FreeCameraController(
    world.keyboardInput,
    renderer,
    {
      keymap: 'wasd',
      mouseOptions: { canvas, pointerLock: true },
      cameraLinearSpeed: 50,
      cameraMovementElasticity: 100,
      cameraRotationSensitivity: 0.8,
      ignoreMouseUnlessPointerLocked: true,
      ignoreKeyboardUnlessPointerLocked: true,
    });
  world.addEntity(cameraController);


  window.addEventListener('mousedown', (event) => {
    let element = <Element>event.target;
    if (element.nodeName == 'A' || world.isPaused)
      return;
    else {
      let ball = world.addPrimitiveRigidBody(
        {
          body: { mass: 10 }, shape: { shape: 'SPHERE', radius: 1.2, collisionMargin: 0.05 },
        },
        renderer.position,
        Qtrn.O,
        { shading: 'phong', color: 0x202020, castShadow: true, receiveShadow: true },
      );

      ball.objectBody!.linearVelocity = Pnt3.rot(Pnt3.scalarMult(Pnt3.nZ, 80), renderer.rotation);
    }
  }, false);

  world.start();

  cameraController.mouseInput.isPointerLocked$.subscribe((l) => {
    if (l) {
      world.resumeWorld();
      document.getElementById('blocker')!.style.display = 'none';
      document.getElementById('message')!.style.display = 'block';
    } else {
      document.getElementById('blocker')!.style.display = 'block';
      document.getElementById('message')!.style.display = 'none';
      world.pauseWorld();
    }
  });
});
