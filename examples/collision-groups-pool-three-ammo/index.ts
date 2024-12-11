import {
  createInlineTickController,
  Entity3d,
  Gg3dWorld,
  GgStatic,
  OrbitCameraController,
  Pnt3,
  Qtrn,
} from '@gg-web-engine/core';
import { ThreeSceneComponent, ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { AmbientLight, DirectionalLight, Material, Mesh } from 'three';
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
world.physicsWorld.maxSubSteps = 25;

world.init().then(async () => {
  const canvas = document.getElementById('gg')! as HTMLCanvasElement;
  const renderer = world.addRenderer(
    world.visualScene.factory.createPerspectiveCamera(),
    canvas,
  );
  renderer.position = { x: 20, y: -16, z: 9 };

  const controller = new OrbitCameraController(renderer, { mouseOptions: { canvas } });
  world.addEntity(controller);

  const dirLight = new DirectionalLight(0xffffff, 1);
  dirLight.color.setHSL(0.1, 1, 0.95);
  dirLight.position.set(50, 50, 70);
  dirLight.lookAt(0, 0, 0);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  const d = 20;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  dirLight.shadow.camera.far = 3500;
  world.visualScene.nativeScene!.add(dirLight);

  const ambient = new AmbientLight(0xffffff, 0.3);
  world.visualScene.nativeScene!.add(ambient);

  const ballsCommonCg = world.physicsWorld.registerCollisionGroup();
  const cgs = [
    0xff0000,
    0x00ff00,
    0x0000ff,
    0xffff00,
    0xff00ff,
  ].map(c => ([c, world.physicsWorld.registerCollisionGroup()]));

  const maxFloorTranslationPerTick = 0.5;
  for (let i = 0; i <= cgs.length; i++) {
    const [color, collisionGroup] = i < cgs.length ? cgs[i] : [0x00ffff, 15];
    const floor = world.addPrimitiveRigidBody({
        shape: { shape: 'BOX', dimensions: { x: 16, y: 16, z: 0.5 } },
        // collision groups can be set immediately when creating entity
        body: {
          dynamic: false,
          restitution: 0.3,
          ownCollisionGroups: [collisionGroup],
          interactWithCollisionGroups: [collisionGroup],
        },
      },
      Pnt3.O,
      Qtrn.O, {
        color,
        shading: 'phong',
        receiveShadow: true,
      });
    ((floor.object3D.nativeMesh as Mesh).material as Material).opacity = 0.4;
    ((floor.object3D.nativeMesh as Mesh).material as Material).transparent = true;
    const slider: HTMLInputElement | undefined = document.getElementById('slider' + i) as any;
    if (slider) {
      createInlineTickController(world).subscribe(() => {
        let diff = +slider.value - floor.position.z;
        if (diff > maxFloorTranslationPerTick) {
          diff = maxFloorTranslationPerTick;
        } else if (diff < -maxFloorTranslationPerTick) {
          diff = -maxFloorTranslationPerTick;
        }
        floor.position = { x: 0, y: 0, z: floor.position.z + diff };
      });
    }
    if (i === cgs.length) {
      floor.position = { x: 0, y: 0, z: -11 };
      const checkboxes = ['rcb', 'gcb', 'bcb', 'ycb', 'pcb'].map(id => document.getElementById(id) as HTMLInputElement);
      createInlineTickController(world).subscribe(() => {
        floor.objectBody.ownCollisionGroups = floor.objectBody.interactWithCollisionGroups = checkboxes
          .map((cb, index) => ({ checked: cb.checked, index }))
          .filter(({ checked }) => checked)
          .map(({ index }) => cgs[index][1]);
      });
    }
  }

  for (let i = 0; i < 4; i++) {
    let wall = new Entity3d({
      objectBody: world.physicsWorld.factory.createRigidBody({
        shape: { shape: 'BOX', dimensions: { x: 40, y: 40, z: 400 } },
        body: {
          dynamic: false,
          ownCollisionGroups: [ballsCommonCg],
          interactWithCollisionGroups: [ballsCommonCg],
          restitution: 0.3,
        },
      }),
    });
    wall.position = Pnt3.rotAround({ x: 28, y: 0, z: 0 }, Pnt3.Z, Math.PI * i / 2);
    world.addEntity(wall);
  }

  for (let i = -7; i <= 7; i++) {
    for (let j = -7; j <= 7; j++) {
      for (let k = 1; k <= 2; k++) {
        const [color, collisionGroup] = cgs[Math.floor(Math.random() * cgs.length)];
        let item = world.addPrimitiveRigidBody(
          {
            shape: { shape: 'SPHERE', radius: 0.48 },
            body: {
              mass: 1,
              restitution: 0.3,
              ownCollisionGroups: [collisionGroup, ballsCommonCg],
              interactWithCollisionGroups: [collisionGroup, ballsCommonCg],
            },
          },
          { x: i, y: j, z: k },
          Qtrn.O,
          { color, shading: 'phong', castShadow: true, receiveShadow: true },
        );
        item.objectBody.nativeBody.setActivationState(4); // btCollisionObject::DISABLE_DEACTIVATION
        item.objectBody.linearVelocity = { x: 2 * Math.random() - 1, y: 2 * Math.random() - 1, z: 0 };
      }
    }
  }

  world.start();
});
