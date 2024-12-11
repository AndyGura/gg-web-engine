import { FreeCameraController, Gg3dWorld, GgStatic, Pnt3, Qtrn } from '@gg-web-engine/core';
import { ThreeSceneComponent, ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { AmbientLight, DirectionalLight, Mesh, MeshPhongMaterial, RepeatWrapping, TextureLoader } from 'three';
import { AmmoPhysicsTypeDocRepo, AmmoWorldComponent } from '@gg-web-engine/ammo';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

const world = new Gg3dWorld<
  ThreeVisualTypeDocRepo,
  AmmoPhysicsTypeDocRepo,
  ThreeSceneComponent,
  AmmoWorldComponent
>(
  new ThreeSceneComponent(),
  new AmmoWorldComponent(),
);
world.physicsWorld.maxSubSteps = 10;
world.physicsWorld.fixedTimeStep = null;

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

  const dirLight = new DirectionalLight(0xffffff, 2.5);
  dirLight.castShadow = true;
  dirLight.position.set(50, 50, 100);
  const d = 100;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  dirLight.shadow.camera.near = 2;
  dirLight.shadow.camera.far = 500;
  dirLight.shadow.mapSize.x = 4096;
  dirLight.shadow.mapSize.y = 4096;
  world.visualScene.nativeScene.add(dirLight);

  const ambientLight = new AmbientLight(0x606060);
  world.visualScene.nativeScene.add(ambientLight);

  const textureLoader = new TextureLoader();
  // create objects
  const [groundTexture, brickTexture] = await Promise.all([
    textureLoader.loadAsync('https://gg-web-demos.guraklgames.com/assets/shooter/cement.jpg'),
    textureLoader.loadAsync('https://gg-web-demos.guraklgames.com/assets/shooter/brick.jpg'),
  ]);
  groundTexture.wrapS = brickTexture.wrapS = RepeatWrapping;
  groundTexture.wrapT = brickTexture.wrapT = RepeatWrapping;
  groundTexture.repeat.set(5, 5);

  let material = [
    new MeshPhongMaterial({ color: 0xB7B7B7, map: brickTexture }),
    new MeshPhongMaterial({ color: 0xAAAAAA, map: brickTexture }),
    new MeshPhongMaterial({ color: 0xA4A4A4, map: brickTexture }),
    new MeshPhongMaterial({ color: 0x979797, map: brickTexture }),
    new MeshPhongMaterial({ color: 0x949494, map: brickTexture }),
    new MeshPhongMaterial({ color: 0x909090, map: brickTexture }),
  ];
  const brickMass = 20;

  const createWall_X_axis = (startX: number, endX: number, y: number, zCount: number, shift: boolean) => {
    for (let z = 0; z <= zCount; z += 1.5) {
      let offsetX = shift ? 1.5 : 0;
      shift = !shift;
      for (let x = startX; x <= endX; x += 3) {
        const item = world.addPrimitiveRigidBody({
          shape: { shape: 'BOX', dimensions: { x: 3, y: 1.5, z: 1.5 }, collisionMargin: 0.05 },
          body: { dynamic: true, mass: brickMass },
        }, { x: x + offsetX, y, z: z + 0.75 }, Qtrn.O, { castShadow: true, receiveShadow: true });
        const materialIndex = Math.floor(Math.random() * material.length);
        (item.object3D.nativeMesh as Mesh).material = material[materialIndex];
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
          body: { dynamic: true, mass: brickMass },
        }, { x, y: y + offsetY, z: z + 0.75 }, Qtrn.O, { castShadow: true, receiveShadow: true });
        item.rotation = quat;
        const materialIndex = Math.floor(Math.random() * material.length);
        (item.object3D.nativeMesh as Mesh).material = material[materialIndex];
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
      body: { dynamic: false, mass: 0 },
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


  let ballMaterial = new MeshPhongMaterial({ color: 0x202020 });

  window.addEventListener('mousedown', (event) => {
    let element = <Element> event.target;
    if (element.nodeName == 'A' || world.isPaused)
      return;
    else {
      let ball = world.addPrimitiveRigidBody(
        {
          body: { mass: 10 }, shape: { shape: 'SPHERE', radius: 1.2, collisionMargin: 0.05 },
        },
        renderer.position,
        Qtrn.O,
        { castShadow: true, receiveShadow: true },
      );
      (ball.object3D.nativeMesh as Mesh).material = ballMaterial;

      ball.objectBody.linearVelocity = Pnt3.rot(Pnt3.scalarMult(Pnt3.nZ, 80), renderer.rotation);
    }
  }, false);

  world.start();

  cameraController.mouseInput.isPointerLocked$.subscribe((l) => {
    if (l) {
      world.resumeWorld();
      document.getElementById('blocker').style.display = 'none';
      document.getElementById('message').style.display = 'block';
    } else {
      document.getElementById('blocker').style.display = 'block';
      document.getElementById('message').style.display = 'none';
      world.pauseWorld();
    }
  });
});
