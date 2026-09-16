import {
  Body3DOptions,
  BodyShape3DDescriptor,
  CharacterController3dOptions,
  getCylinderRadii,
  IPhysicsBody3dComponentFactory,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  Shape3DDescriptor,
} from '@gg-web-engine/core';
import { ActiveEvents, ColliderDesc, Quaternion, RigidBodyDesc } from '@dimforge/rapier3d-compat';
import { Rapier3dRigidBodyComponent } from './components/rapier-3d-rigid-body.component';
import { Rapier3dTriggerComponent } from './components/rapier-3d-trigger.component';
import { Rapier3dCharacterControllerComponent } from './components/rapier-3d-character-controller.component';
import { Rapier3dWorldComponent } from './components/rapier-3d-world.component';
import { Rapier3dPhysicsTypeDocRepo } from './types';

const DEFAULT_CHARACTER_CONTROLLER_OPTIONS: Required<Omit<CharacterController3dOptions, 'radius' | 'centersDistance'>> =
  {
    offset: 0.01,
    maxStepHeight: 0.3,
    minStepWidth: 0.2,
    maxSlopeClimbAngleRad: (50 * Math.PI) / 180,
    snapToGroundDistance: 0.3,
    up: Pnt3.Z,
    ownCollisionGroups: 'all',
    interactWithCollisionGroups: 'all',
    // `Rapier3dCharacterControllerComponent.addToWorld` wires this straight into Rapier's own
    // `KinematicCharacterController.setCharacterMass` + `setApplyImpulsesToDynamicBodies(true)` -
    // unlike the ammo adapter, no hand-rolled push logic needed, Rapier already computes it.
    pushMass: 80,
  };

export class Rapier3dFactory implements IPhysicsBody3dComponentFactory<Rapier3dPhysicsTypeDocRepo> {
  constructor(protected readonly world: Rapier3dWorldComponent) {}

  createRigidBody(
    descriptor: BodyShape3DDescriptor,
    transform?: {
      position?: Point3;
      rotation?: Point4;
    },
  ): Rapier3dRigidBodyComponent {
    // `Rapier3dRigidBodyComponent.onCollisionStart`/`onCollisionEnd` are backed by Rapier's own
    // collision-event queue (drained centrally by `Rapier3dWorldComponent.simulate`), which only
    // reports a contact pair when *at least one* of its two colliders has `COLLISION_EVENTS` active
    // (triggers already set this on their own sensor collider - see `createTrigger` below - but an
    // ordinary rigid-body-vs-rigid-body contact needs it here too, since neither side had it before).
    const colliderDescr = this.createColliderDescr(descriptor.shape);
    colliderDescr.forEach(c => c.setActiveEvents(ActiveEvents.COLLISION_EVENTS));
    return new Rapier3dRigidBodyComponent(
      this.world,
      colliderDescr,
      descriptor.shape,
      this.createRigidBodyDescr(descriptor.body, transform),
      {
        friction: 0.5,
        restitution: 0.1,
        ownCollisionGroups: [this.world.mainCollisionGroup],
        interactWithCollisionGroups: [this.world.mainCollisionGroup],
        ccd: false,
        ...descriptor.body,
      },
    );
  }

  createTrigger(
    descriptor: Shape3DDescriptor,
    transform?: {
      position?: Point3;
      rotation?: Point4;
    },
  ): Rapier3dTriggerComponent {
    const colliderDescr = this.createColliderDescr(descriptor);
    colliderDescr.forEach(c => {
      c.isSensor = true;
      c.setActiveEvents(ActiveEvents.COLLISION_EVENTS);
    });
    return new Rapier3dTriggerComponent(
      this.world,
      colliderDescr,
      descriptor,
      this.createRigidBodyDescr({ bodyType: 'static' }, transform),
    );
  }

  createRaycastVehicle(chassis: Rapier3dRigidBodyComponent): never {
    throw new Error('Raycast vehicle bindings for rapier3D are not implemented');
  }

  createCharacterController(
    options: CharacterController3dOptions,
    transform?: {
      position?: Point3;
      rotation?: Point4;
    },
  ): Rapier3dCharacterControllerComponent {
    const resolvedOptions: Required<CharacterController3dOptions> = {
      ...DEFAULT_CHARACTER_CONTROLLER_OPTIONS,
      ownCollisionGroups: [this.world.mainCollisionGroup],
      ...options,
    };
    const bodyDescr = RigidBodyDesc.kinematicPositionBased();
    const pos = transform?.position || Pnt3.O;
    const rot = transform?.rotation || Qtrn.O;
    bodyDescr.setTranslation(pos.x, pos.y, pos.z).setRotation(new Quaternion(rot.x, rot.y, rot.z, rot.w));
    return new Rapier3dCharacterControllerComponent(this.world, resolvedOptions, bodyDescr);
  }

  public createColliderDescr(descriptor: Shape3DDescriptor): ColliderDesc[] {
    const yToZUp = Qtrn.rotAround(Qtrn.O, Pnt3.X, Math.PI / 2);
    switch (descriptor.shape) {
      // TODO looks like not exposed in rapier3d-compat
      // case 'PLANE':
      //   return [
      //     ColliderDesc.halfspace(new Vector3(0, 0, 1)),
      //   ];
      case 'BOX':
        return [
          ColliderDesc.cuboid(descriptor.dimensions.x / 2, descriptor.dimensions.y / 2, descriptor.dimensions.z / 2),
        ];
      case 'CAPSULE':
        const capsule = ColliderDesc.capsule(descriptor.centersDistance / 2, descriptor.radius);
        capsule.setRotation(new Quaternion(yToZUp.x, yToZUp.y, yToZUp.z, yToZUp.w));
        return [capsule];
      case 'CYLINDER': {
        const { radiusX, radiusY } = getCylinderRadii(descriptor);
        if (radiusX === radiusY) {
          const cylinder = ColliderDesc.cylinder(descriptor.height / 2, radiusX);
          cylinder.setRotation(new Quaternion(yToZUp.x, yToZUp.y, yToZUp.z, yToZUp.w));
          return [cylinder];
        }
        // Rapier/parry has no native elliptical-radius primitive (unlike Bullet's
        // btCylinderShapeZ, which takes independent X/Y half-extents) - approximate with a
        // convex hull over the two elliptical end-cap rings instead.
        const ellipseSegments = 32;
        const halfHeight = descriptor.height / 2;
        const vertices: number[] = [];
        for (let i = 0; i < ellipseSegments; i++) {
          const angle = (i / ellipseSegments) * Math.PI * 2;
          const x = radiusX * Math.cos(angle);
          const y = radiusY * Math.sin(angle);
          vertices.push(x, y, -halfHeight, x, y, halfHeight);
        }
        return [ColliderDesc.convexHull(new Float32Array(vertices))!];
      }
      case 'CONE':
        const cone = ColliderDesc.cone(descriptor.height / 2, descriptor.radius);
        cone.setRotation(new Quaternion(yToZUp.x, yToZUp.y, yToZUp.z, yToZUp.w));
        return [cone];
      case 'SPHERE':
        return [ColliderDesc.ball(descriptor.radius)];
      case 'COMPOUND':
        const res: ColliderDesc[] = [];
        for (const item of descriptor.children) {
          const subDescr = this.createColliderDescr(item.shape);
          subDescr.forEach(d => {
            const p = Pnt3.add(item.position || Pnt3.O, d.translation);
            const r = Qtrn.combineRotations(item.rotation || Qtrn.O, d.rotation);
            d.setTranslation(p.x, p.y, p.z);
            d.setRotation(new Quaternion(r.x, r.y, r.z, r.w));
          });
          res.push(...subDescr);
        }
        return res;
      case 'CONVEX_HULL':
        return [
          ColliderDesc.convexHull(
            new Float32Array(
              descriptor.vertices
                .map(p => [p.x, p.y, p.z])
                .reduce((acc, curVal) => {
                  return acc.concat(curVal);
                }, []),
            ),
          )!,
        ];
      case 'MESH':
        return [
          ColliderDesc.trimesh(
            new Float32Array(
              descriptor.vertices
                .map(p => [p.x, p.y, p.z])
                .reduce((acc, curVal) => {
                  return acc.concat(curVal);
                }, []),
            ),
            new Uint32Array(
              descriptor.faces.reduce((acc, curVal) => {
                return acc.concat(curVal);
              }, [] as number[]),
            ),
          ),
        ];
    }
    throw new Error(`Shape "${(descriptor as any).shape}" not implemented for Rapier 3D`);
  }

  public createRigidBodyDescr(
    options: Partial<Body3DOptions>,
    transform?: { position?: Point3; rotation?: Point4 },
  ): RigidBodyDesc {
    const pos = transform?.position || Pnt3.O;
    const rot = transform?.rotation || Qtrn.O;
    let bodyDesc!: RigidBodyDesc;
    let bodyType = options.bodyType || (options.mass ? 'dynamic' : 'static');
    if (bodyType === 'static') {
      bodyDesc = RigidBodyDesc.fixed();
    } else if (bodyType === 'kinematic_pos') {
      bodyDesc = RigidBodyDesc.kinematicPositionBased();
    } else if (bodyType === 'kinematic_vel') {
      bodyDesc = RigidBodyDesc.kinematicVelocityBased();
    } else {
      bodyDesc = RigidBodyDesc.dynamic();
      bodyDesc.mass = options.mass || 1;
      // Only a dynamic body can tunnel through geometry it crosses within a single step - a fixed
      // or kinematic body is never the one doing the moving-too-fast-to-detect part of that, so CCD
      // is meaningless for either (see `BodyOptions.ccd`'s own doc).
      bodyDesc.setCcdEnabled(!!options.ccd);
    }
    return bodyDesc.setTranslation(pos.x, pos.y, pos.z).setRotation(new Quaternion(rot.x, rot.y, rot.z, rot.w));
  }
}
