import {
  Body3DOptions,
  BodyShape3DDescriptor,
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
import { Rapier3dWorldComponent } from './components/rapier-3d-world.component';
import { Rapier3dPhysicsTypeDocRepo } from './types';

export class Rapier3dFactory implements IPhysicsBody3dComponentFactory<Rapier3dPhysicsTypeDocRepo> {
  constructor(protected readonly world: Rapier3dWorldComponent) {}

  createRigidBody(
    descriptor: BodyShape3DDescriptor,
    transform?: {
      position?: Point3;
      rotation?: Point4;
    },
  ): Rapier3dRigidBodyComponent {
    return new Rapier3dRigidBodyComponent(
      this.world,
      this.createColliderDescr(descriptor.shape),
      descriptor.shape,
      this.createRigidBodyDescr(descriptor.body, transform),
      {
        friction: 0.5,
        restitution: 0.1,
        ownCollisionGroups: 'all',
        interactWithCollisionGroups: 'all',
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
      this.createRigidBodyDescr({ dynamic: false }, transform),
    );
  }

  createRaycastVehicle(chassis: Rapier3dRigidBodyComponent): never {
    throw new Error('Raycast vehicle bindings for rapier3D are not implemented');
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
      case 'CYLINDER':
        const cylinder = ColliderDesc.cylinder(descriptor.height / 2, descriptor.radius);
        cylinder.setRotation(new Quaternion(yToZUp.x, yToZUp.y, yToZUp.z, yToZUp.w));
        return [cylinder];
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
    const fixed = options.dynamic === false || !options.mass;
    let bodyDesc!: RigidBodyDesc;
    if (fixed) {
      bodyDesc = RigidBodyDesc.fixed();
    } else {
      bodyDesc = RigidBodyDesc.dynamic();
      bodyDesc.mass = options.mass || 1;
    }
    return bodyDesc.setTranslation(pos.x, pos.y, pos.z).setRotation(new Quaternion(rot.x, rot.y, rot.z, rot.w));
  }
}
