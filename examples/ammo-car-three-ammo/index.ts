import {
  CarKeyboardHandlingController,
  createInlineTickController,
  Gg3dWorld,
  GgStatic,
  OrbitCameraController,
  Pnt3,
  Qtrn,
  RaycastVehicle3dEntity,
  RVEntityTractionBias,
} from '@gg-web-engine/core';
import { ThreeDisplayObject3dOpts, ThreeSceneComponent, ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { AmbientLight, DirectionalLight } from 'three';
import { AmmoPhysicsTypeDocRepo, AmmoWorldComponent } from '@gg-web-engine/ammo';

const world = new Gg3dWorld<
  ThreeVisualTypeDocRepo,
  AmmoPhysicsTypeDocRepo,
  ThreeSceneComponent,
  AmmoWorldComponent
>(
  new ThreeSceneComponent(),
  new AmmoWorldComponent(),
);
GgStatic.instance.showStats = true;
// GgStatic.instance.devConsoleEnabled = true;
world.init().then(async () => {
  // init graphics
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;
  const renderer = world.addRenderer(
    world.visualScene.factory.createPerspectiveCamera({ fov: 60 }),
    canvas,
    { background: 0xbfd1e5 },
  );
  renderer.camera.position = { x: 4.84, y: -35.11, z: 4.39 };
  renderer.camera.rotation = Qtrn.lookAt(
    renderer.camera.position,
    { x: -0.33, y: -0.4, z: 0.85 },
    { x: 0, y: 0, z: 1 },
  );

  const dirLight = new DirectionalLight(0xffffff, 4);
  dirLight.position.set(-10, 5, 10);
  world.visualScene.nativeScene.add(dirLight);

  const ambientLight = new AmbientLight(0x404040, 4);
  world.visualScene.nativeScene.add(ambientLight);

  const materialDynamic: ThreeDisplayObject3dOpts = { shading: 'phong', color: 0xfca400 };
  const materialStatic: ThreeDisplayObject3dOpts = { shading: 'phong', color: 0x999999 };
  const materialInteractive: ThreeDisplayObject3dOpts = { shading: 'phong', color: 0x990000 };

  // create objects
  world.addPrimitiveRigidBody({
    shape: { shape: 'BOX', dimensions: { x: 75, y: 75, z: 1 } },
    body: { dynamic: false, mass: 0 },
  }, { x: 0, y: 0, z: -0.5 }, Qtrn.O, materialStatic);
  world.addPrimitiveRigidBody({
    shape: { shape: 'BOX', dimensions: { x: 8, y: 10, z: 4 } },
    body: { dynamic: false, mass: 0 },
  }, { x: 0, y: 0, z: -1.5 }, Qtrn.fromAngle(Pnt3.X, Math.PI / 18), materialStatic);
  const size = 0.75;
  const nw = 8;
  const nh = 6;
  for (let j = 0; j < nw; j++)
    for (let i = 0; i < nh; i++) {
      const item = world.addPrimitiveRigidBody({
        shape: { shape: 'BOX', dimensions: { x: size, y: size, z: size } },
        body: { dynamic: true, mass: 10 },
      }, { x: size * j - (size * (nw - 1)) / 2, y: 10, z: size * (i + 0.5) }, Qtrn.O, materialDynamic);
    }

  const vehiclePos = { x: 0, y: -20, z: 4 };
  const chassisDimensions = { x: 1.8, y: 4, z: 0.6 };
  const chassis = world.physicsWorld.factory.createRigidBody({
    shape: { shape: 'BOX', dimensions: chassisDimensions },
    body: { mass: 800 },
  });
  const chassisMesh = world.visualScene.factory.createBox(
    chassisDimensions,
    materialInteractive,
  );
  const createWheelMesh = (radius: number, width: number) => {
    let m = world.visualScene.factory.createCylinder(radius, width, materialInteractive);
    m.nativeMesh.add(
      world.visualScene.factory.createBox({
        x: radius * 1.75,
        y: radius * 0.25,
        z: width * 1.5,
      }, materialInteractive).nativeMesh,
    );
    return m;
  };

  const carController = new CarKeyboardHandlingController(
    world.keyboardInput,
    { keymap: 'wasd', maxSteerDeltaPerSecond: .04 * 120 / .5 },
  );
  world.addEntity(carController);

  const vehicle = new RaycastVehicle3dEntity(
    {
      suspension: {
        compression: 4.4,
        damping: 2.3,
        restLength: 0.6,
        stiffness: 20,
      },
      tractionBias: RVEntityTractionBias.RWD,
      wheelBase: {
        shared: {
          frictionSlip: 1000,
          rollInfluence: 0.2,
          maxTravel: 5,
          display: { wheelObjectDirection: 'z' },
        },
        front: {
          halfAxleWidth: 1,
          axlePosition: 1.7,
          axleHeight: 0.3,
          tyreRadius: 0.35,
          tyreWidth: 0.2,
          display: { displayObject: createWheelMesh(0.35, 0.2) },
        },
        rear: {
          halfAxleWidth: 1,
          axlePosition: -1,
          axleHeight: 0.3,
          tyreRadius: 0.4,
          tyreWidth: 0.3,
          display: { displayObject: createWheelMesh(0.4, 0.3) },
        },
      },
    },
    chassisMesh,
    world.physicsWorld.factory.createRaycastVehicle(chassis),
  );
  vehicle.position = vehiclePos;
  world.addEntity(vehicle);

  carController.output$.subscribe(({ leftRight, upDown }) => {
    let engineForce = 0;
    let breakingForce = 0;
    if (upDown > 0) {
      if (vehicle.getSpeed() < -1) {
        breakingForce = 100;
      } else {
        engineForce = 2000;
      }
    }
    if (upDown < 0) {
      if (vehicle.getSpeed() > 1) {
        breakingForce = 100;
      } else {
        engineForce = -1000;
      }
    }
    vehicle.steeringAngle = .5 * leftRight;
    vehicle.applyTraction('rear', engineForce);
    vehicle.applyBrake('front', breakingForce / 2);
    vehicle.applyBrake('rear', breakingForce);
  });

  const cameraController = new OrbitCameraController(renderer, {
    mouseOptions: { canvas },
  });
  world.addEntity(cameraController);

  const speedometer = document.getElementById('speedometer');
  createInlineTickController(world).subscribe(() => {
    const speed = vehicle.getSpeed() * 3.6;
    speedometer.innerHTML =
      (speed < 0 ? '(R) ' : '') + Math.abs(speed).toFixed(1) + ' km/h';
  });

  world.start();
});
