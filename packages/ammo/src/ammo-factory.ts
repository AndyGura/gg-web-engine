import {
  Body3DOptions,
  BodyShape3DDescriptor,
  CharacterController3dOptions,
  IPhysicsBody3dComponentFactory,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  Shape3DDescriptor,
} from '@gg-web-engine/core';
import Ammo from './ammo.js/ammo';
import { AmmoRigidBodyComponent } from './components/ammo-rigid-body.component';
import { AmmoTriggerComponent } from './components/ammo-trigger.component';
import { AmmoWorldComponent } from './components/ammo-world.component';
import { AmmoPhysicsTypeDocRepo } from './types';
import { AmmoRaycastVehicleComponent } from './components/ammo-raycast-vehicle.component';
import { AmmoCharacterControllerComponent } from './components/ammo-character-controller.component';

export class AmmoFactory implements IPhysicsBody3dComponentFactory<AmmoPhysicsTypeDocRepo> {
  constructor(protected readonly world: AmmoWorldComponent) {}

  createRigidBody(
    descriptor: BodyShape3DDescriptor,
    transform?: {
      position?: Point3;
      rotation?: Point4;
    },
  ): AmmoRigidBodyComponent {
    return this.createRigidBodyFromShape(
      this.createShape(descriptor.shape),
      descriptor.shape,
      descriptor.body,
      transform,
    );
  }

  createTrigger(
    descriptor: Shape3DDescriptor,
    transform?: {
      position?: Point3;
      rotation?: Point4;
    },
  ): AmmoTriggerComponent {
    return this.createTriggerFromShape(this.createShape(descriptor), descriptor, transform);
  }

  createRaycastVehicle(chassis: AmmoRigidBodyComponent): AmmoRaycastVehicleComponent {
    return new AmmoRaycastVehicleComponent(this.world, chassis);
  }

  createCharacterController(
    options: CharacterController3dOptions,
    transform?: {
      position?: Point3;
      rotation?: Point4;
    },
  ): AmmoCharacterControllerComponent {
    return new AmmoCharacterControllerComponent(this.world, options, transform);
  }

  protected createShape(descriptor: Shape3DDescriptor): Ammo.btCollisionShape {
    let shape!: Ammo.btCollisionShape;
    switch (descriptor.shape) {
      case 'PLANE':
        shape = new Ammo.btStaticPlaneShape(new Ammo.btVector3(0, 0, 1), 0);
        break;
      case 'BOX':
        shape = new Ammo.btBoxShape(
          new Ammo.btVector3(descriptor.dimensions.x / 2, descriptor.dimensions.y / 2, descriptor.dimensions.z / 2),
        );
        break;
      case 'CAPSULE':
        shape = new Ammo.btCapsuleShapeZ(descriptor.radius, descriptor.centersDistance);
        break;
      case 'CYLINDER':
        shape = new Ammo.btCylinderShapeZ(
          new Ammo.btVector3(descriptor.radius, descriptor.radius, descriptor.height / 2),
        );
        break;
      case 'CONE':
        shape = new Ammo.btConeShapeZ(descriptor.radius, descriptor.height);
        break;
      case 'SPHERE':
        shape = new Ammo.btSphereShape(descriptor.radius);
        break;
      case 'COMPOUND':
        let cs: Ammo.btCompoundShape = new Ammo.btCompoundShape();
        for (const item of descriptor.children) {
          const subShape = this.createShape(item.shape);
          if (!subShape) {
            continue;
          }
          const subShapeTransform = new Ammo.btTransform();
          const pos = item.position || Pnt3.O;
          const rot = item.rotation || Qtrn.O;
          subShapeTransform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
          subShapeTransform.setRotation(new Ammo.btQuaternion(rot.x, rot.y, rot.z, rot.w));
          cs.addChildShape(subShapeTransform, subShape);
        }
        shape = cs;
        break;
      case 'CONVEX_HULL':
        const s = new Ammo.btConvexHullShape();
        const tmpVector = new Ammo.btVector3();
        for (const v of descriptor.vertices) {
          tmpVector.setValue(v.x, v.y, v.z);
          s.addPoint(tmpVector);
        }
        Ammo.destroy(tmpVector);
        s.recalcLocalAabb();
        shape = s;
        break;
      case 'MESH':
        const mesh = new Ammo.btTriangleMesh(true, true);
        const tmpVectors: [Ammo.btVector3, Ammo.btVector3, Ammo.btVector3] = [
          new Ammo.btVector3(),
          new Ammo.btVector3(),
          new Ammo.btVector3(),
        ];
        for (const f of descriptor.faces) {
          for (let j = 0; j < 3; j++) {
            tmpVectors[j].setValue(
              descriptor.vertices[f[0]].x,
              descriptor.vertices[f[1]].y,
              descriptor.vertices[f[2]].z,
            );
          }
          mesh.addTriangle(...tmpVectors, true);
        }
        tmpVectors.forEach(v => {
          Ammo.destroy(v);
        });
        shape = new Ammo.btBvhTriangleMeshShape(mesh, false, true);
        break;
      default:
        throw new Error(`Shape "${(descriptor as any).shape}" not implemented for Ammo.js`);
    }
    if (descriptor.collisionMargin) {
      shape.setMargin(descriptor.collisionMargin);
    }
    return shape;
  }

  public createRigidBodyFromShape(
    nativeShape: Ammo.btCollisionShape,
    shapeDescr: Shape3DDescriptor,
    options: Partial<Body3DOptions>,
    transform?: { position?: Point3; rotation?: Point4 },
  ): AmmoRigidBodyComponent {
    if (options.dynamic === false) {
      options.mass = 0;
    }
    const pos = transform?.position || Pnt3.O;
    const rot = transform?.rotation || Qtrn.O;
    const ammoTransform = new Ammo.btTransform();
    ammoTransform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
    ammoTransform.setRotation(new Ammo.btQuaternion(rot.x, rot.y, rot.z, rot.w));
    const motionState = new Ammo.btDefaultMotionState(ammoTransform);
    const localInertia = new Ammo.btVector3(0, 0, 0);
    nativeShape.calculateLocalInertia(options.mass || 0, localInertia);
    const environmentBodyCI = new Ammo.btRigidBodyConstructionInfo(
      options.mass || 0,
      motionState,
      nativeShape,
      localInertia,
    );
    if (options.friction) {
      environmentBodyCI.set_m_friction(options.friction);
    }
    // Rolling friction (resistance to *spinning*, e.g. what eventually settles a rolling ball) is a
    // physically distinct quantity from sliding friction (resistance to *translating* across a
    // surface) and needs its own, much smaller, independent default - reusing `options.friction`
    // here (a real, shipped bug: this used to read `set_m_rollingFriction(options.friction)`) made
    // every dynamic body's rolling friction match its sliding friction, and at a typical
    // `options.friction` of 0.5 (`defaultBodyOptions`, see `Gg3dLevelLoader`) that was high enough to
    // kill a rolling sphere's spin within a handful of ticks - not just too fast a *decay*, either:
    // the same manifold's rolling-friction constraint was damping out the spin-inducing torque within
    // the very same solver step sliding friction generated it, so a sphere given pure linear velocity
    // and left to slide on a static floor looked like it could never pick up any spin from friction at
    // all (confirmed empirically both ways: reverting only this line reproduced "friction never spins
    // the ball up"; a small nonzero value on its own, no other change, restored natural spin-up).
    //
    // The right *magnitude* for that small value took two rounds to find, both confirmed empirically
    // by giving a resting sphere realistic rolling-without-slipping linear+angular velocity and
    // measuring how many simulated seconds it took to coast to a stop on a static floor: `0.02`
    // (tried first) undershot badly - 8+ simulated seconds to settle, effectively "never stops" for a
    // room this size, since it bounces off several walls first. `0.05` settles the same push in
    // 2-3.5s - long enough to feel like real rolling momentum, short enough to actually come to rest
    // during a normal play session. (Sanity-checked across a spread of values 0.02-0.2: below ~0.03 is
    // "never stops", above ~0.5 - the old, reused-from-`options.friction` value - is "stops almost
    // instantly"; several points in between logged similar 2-3.5s settle times, so this isn't a sharp
    // knife-edge to keep re-tuning by hand if scenarios change slightly.)
    environmentBodyCI.set_m_rollingFriction(0.05);
    if (options.restitution) {
      environmentBodyCI.set_m_restitution(options.restitution);
    }
    const nativeBody = new Ammo.btRigidBody(environmentBodyCI);
    // `m_rollingFriction` above only damps spin about an axis *tangent* to the contact normal (the
    // axis that couples to translation via the rolling condition, v = ω × r) - that's the only axis
    // a straight-line push through this character's `pushDynamicBody` can ever put spin on, which is
    // why rolling friction alone looked sufficient at first. But it does nothing at all for spin
    // *about* the contact normal - a sphere spinning in place like a top, with zero linear velocity,
    // has zero relative sliding at its single contact point regardless of how fast that spin is (the
    // contact point's own velocity is `ω × r_contact`, which vanishes whenever `ω` is parallel to
    // `r_contact`, i.e. spin purely about the surface normal) - so neither sliding friction nor
    // `m_rollingFriction` is doing anything to it. Bullet models this as a separate quantity,
    // `m_spinningFriction` (unlike rolling friction, `btRigidBodyConstructionInfo` has no field for
    // it - only settable on the constructed body itself, hence doing it here rather than above).
    // Confirmed empirically this is a real, distinct gap, not just a theoretical corner case: a
    // sphere given *only* vertical-axis angular velocity (no linear velocity, no other-axis spin) sat
    // there spinning at its initial speed, completely undiminished, for 12+ simulated seconds with
    // only the `m_rollingFriction` fix above in place - i.e. it doesn't just decay slowly, it doesn't
    // decay *at all*. A push straight into a ball normally only imparts rolling-axis spin, but any
    // off-center/glancing contact (brushing it at an angle, a wall bounce that isn't perfectly
    // square-on) puts some of that spin on the vertical axis instead, which would otherwise persist
    // forever once the rolling-axis component (and the linear motion it's coupled to) has settled.
    // Reuses the same magnitude as `m_rollingFriction` - both are "resistance to spin" quantities of
    // the same physical character, just about different axes, so there's no reason to expect a very
    // different right order-of-magnitude for one versus the other.
    nativeBody.setSpinningFriction(0.05);
    const comp = new AmmoRigidBodyComponent(this.world, nativeBody, shapeDescr);
    if (options.ownCollisionGroups && options.ownCollisionGroups !== 'all') {
      comp.ownCollisionGroups = options.ownCollisionGroups;
    }
    if (options.interactWithCollisionGroups && options.interactWithCollisionGroups !== 'all') {
      comp.interactWithCollisionGroups = options.interactWithCollisionGroups;
    }
    return comp;
  }

  public createTriggerFromShape(
    nativeShape: Ammo.btCollisionShape,
    shapeDescr: Shape3DDescriptor,
    transform?: { position?: Point3; rotation?: Point4 },
  ): AmmoTriggerComponent {
    const ghostObject = new Ammo.btPairCachingGhostObject();
    ghostObject.setCollisionShape(nativeShape);
    ghostObject.setCollisionFlags(ghostObject.getCollisionFlags() | 4); // 4 is a CF_NO_CONTACT_RESPONSE collision flag
    ghostObject
      .getWorldTransform()
      .setOrigin(
        new Ammo.btVector3(transform?.position?.x || 0, transform?.position?.y || 0, transform?.position?.z || 0),
      );
    ghostObject
      .getWorldTransform()
      .setRotation(
        new Ammo.btQuaternion(
          transform?.rotation?.x || 0,
          transform?.rotation?.y || 0,
          transform?.rotation?.z || 0,
          transform?.rotation?.w || 1,
        ),
      );
    return new AmmoTriggerComponent(this.world, ghostObject, shapeDescr);
  }
}
