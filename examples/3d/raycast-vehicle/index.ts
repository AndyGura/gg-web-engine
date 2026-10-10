import {
  CarHandlingController,
  createInlineTickController,
  Gg3dWorld,
  GgStatic,
  LoadingScreen,
  OrbitCameraController,
  Pnt3,
  Qtrn,
  RaycastVehicle3dEntity,
  RVEntityTractionBias,
} from '@gg-web-engine/core';
import { MobileControls } from '@gg-web-engine/mobile-controls';
import { ThreeDisplayObject3dOpts, ThreeGgWorld, ThreeSceneComponent } from '@gg-web-engine/three';
import { createPhysicsWorld } from './backends';

GgStatic.instance.showStats = true;
GgStatic.instance.devConsoleEnabled = true;

// the engine's loading screen, up until the game runs (hidden after world.start() below)
const loading = LoadingScreen.show();
const world: ThreeGgWorld = new Gg3dWorld({
  visualScene: new ThreeSceneComponent(),
  physicsWorld: await createPhysicsWorld(),
});
world.init().then(async () => {
  // init graphics
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;
  const renderer = world.addRenderer(world.visualScene.factory.createPerspectiveCamera({ fov: 60 }), canvas, {
    background: 0xbfd1e5,
  });
  renderer.camera.position = { x: 4.84, y: -35.11, z: 4.39 };
  renderer.camera.rotation = Qtrn.lookAt(
    renderer.camera.position,
    { x: -0.33, y: -0.4, z: 0.85 },
    { x: 0, y: 0, z: 1 },
  );

  world.addLight({ type: 'DIRECTIONAL', intensity: 4 }, { x: -10, y: 5, z: 10 }, Pnt3.O);
  world.addLight({ type: 'AMBIENT', color: 0x404040, intensity: 4 });

  const materialDynamic: ThreeDisplayObject3dOpts = { shading: 'phong', color: 0xfca400 };
  const materialStatic: ThreeDisplayObject3dOpts = { shading: 'phong', color: 0x999999 };
  const materialInteractive: ThreeDisplayObject3dOpts = { shading: 'phong', color: 0x990000 };

  // create objects
  world.addPrimitiveRigidBody(
    {
      shape: { shape: 'BOX', dimensions: { x: 75, y: 75, z: 1 } },
      body: { bodyType: 'static', mass: 0 },
    },
    { x: 0, y: 0, z: -0.5 },
    Qtrn.O,
    materialStatic,
  );
  world.addPrimitiveRigidBody(
    {
      shape: { shape: 'BOX', dimensions: { x: 8, y: 10, z: 4 } },
      body: { bodyType: 'static', mass: 0 },
    },
    { x: 0, y: 0, z: -1.5 },
    Qtrn.fromAngle(Pnt3.X, Math.PI / 18),
    materialStatic,
  );
  const size = 0.75;
  const nw = 8;
  const nh = 6;
  for (let j = 0; j < nw; j++)
    for (let i = 0; i < nh; i++) {
      const item = world.addPrimitiveRigidBody(
        {
          shape: { shape: 'BOX', dimensions: { x: size, y: size, z: size } },
          body: { bodyType: 'dynamic', mass: 10 },
        },
        { x: size * j - (size * (nw - 1)) / 2, y: 10, z: size * (i + 0.5) },
        Qtrn.O,
        materialDynamic,
      );
    }

  const vehiclePos = { x: 0, y: -20, z: 4 };
  const chassisDimensions = { x: 1.8, y: 4, z: 0.6 };
  const chassis = world.physicsWorld!.factory.createRigidBody({
    shape: { shape: 'BOX', dimensions: chassisDimensions },
    body: { mass: 800 },
  });
  const chassisMesh = world.visualScene.factory.createBox(chassisDimensions, materialInteractive);
  const createWheelMesh = (radius: number, width: number) => {
    const wheel = world.visualScene.factory.createCylinder(radius, width, materialInteractive);
    // a bar across the wheel, nested in it so it spins along and shows the wheel turning
    wheel.addChild(
      world.visualScene.factory.createBox(
        {
          x: radius * 1.75,
          y: radius * 0.25,
          z: width * 1.5,
        },
        materialInteractive,
      ),
    );
    return wheel;
  };

  const carController = new CarHandlingController(world.keyboardInput, {
    keymap: 'wasd',
    maxSteerDeltaPerSecond: (0.04 * 120) / 0.5,
  });
  world.addEntity(carController);
  // on-screen controls on phones and tablets; does nothing on a desktop
  world.addEntity(new MobileControls());

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
    world.physicsWorld!.factory.createRaycastVehicle(chassis),
  );
  vehicle.position = vehiclePos;
  world.addEntity(vehicle);

  // tyre smoke: puffs from the rear wheels while braking at speed, simulated in 30 Hz steps like an
  // old game would, and left behind in world space as the car drives on
  let braking = false;
  const smokeCanvas = document.createElement('canvas');
  smokeCanvas.width = smokeCanvas.height = 64;
  const smokeContext = smokeCanvas.getContext('2d')!;
  const gradient = smokeContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  smokeContext.fillStyle = gradient;
  smokeContext.fillRect(0, 0, 64, 64);
  // wheel contact points in the chassis frame
  const rearWheels = [
    { x: -1, y: -1, z: -0.6 },
    { x: 1, y: -1, z: -0.6 },
  ];
  world.addParticleSystem(
    { capacity: 200, texture: world.visualScene.factory.createTextureFromCanvas(smokeCanvas) },
    {
      attachTo: vehicle,
      fixedTimeStep: 1 / 30,
      lifetime: [0.8, 1.4],
      tint: 0xdddddd,
      gravity: { x: 0, y: 0, z: 0.6 },
      drag: 1.5,
      sizeOverLife: [1, 3],
      opacityOverLife: [0.5, 0],
      onStep: (dt, smoke) => {
        const speed = Math.abs(vehicle.getSpeed());
        if (!braking || speed < 3) {
          return;
        }
        for (const wheel of rearWheels) {
          smoke.emit(1, (p, ctx) => {
            p.position = ctx.pointToSim(wheel);
            p.velocity = { x: ctx.range(-0.3, 0.3), y: ctx.range(-0.3, 0.3), z: 0.3 };
            // the faster the car, the bigger the puff
            p.size.x = p.size.y = 0.3 + speed * 0.03;
            p.angularVelocity = ctx.range(-1, 1);
          });
        }
      },
    },
  );

  carController.output$.subscribe(({ leftRight, upDown }) => {
    // Newtons per wheel
    let engineForce = 0;
    let breakingForce = 0;
    if (upDown > 0) {
      if (vehicle.getSpeed() < -1) {
        breakingForce = 12000;
      } else {
        engineForce = 2000;
      }
    }
    if (upDown < 0) {
      if (vehicle.getSpeed() > 1) {
        breakingForce = 12000;
      } else {
        engineForce = -1000;
      }
    }
    braking = breakingForce > 0;
    vehicle.steeringAngle = 0.5 * leftRight;
    vehicle.applyTraction('rear', engineForce);
    vehicle.applyBrake('front', breakingForce / 2);
    vehicle.applyBrake('rear', breakingForce);
  });

  const cameraController = new OrbitCameraController(renderer, {
    mouseOptions: { canvas },
  });
  world.addEntity(cameraController);

  const speedometer = document.getElementById('speedometer')!;
  createInlineTickController(world).subscribe(() => {
    const speed = vehicle.getSpeed() * 3.6;
    speedometer.innerHTML = (speed < 0 ? '(R) ' : '') + Math.abs(speed).toFixed(1) + ' km/h';
  });

  world.start();
  loading.hide();
});
