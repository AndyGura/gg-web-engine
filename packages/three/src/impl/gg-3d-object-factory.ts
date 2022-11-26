import { IGg3dObjectFactory, Point3 } from '@gg-web-engine/core';
import {
  BoxGeometry,
  CapsuleGeometry, ConeGeometry,
  CylinderGeometry, Group,
  Material,
  Mesh,
  MeshBasicMaterial, Object3D,
  SphereGeometry
} from 'three';
import { Gg3dObject } from './gg-3d-object';

export class Gg3dObjectFactory implements IGg3dObjectFactory<Gg3dObject> {
  getRandomMaterial(): Material {
    return new MeshBasicMaterial(
      { color: Math.floor(Math.random() * 256) << 16 | Math.floor(Math.random() * 256) << 8 | Math.floor(Math.random() * 256) }
    );
  }
  // most three.js primitives are designed to use Y as up coordinate, like cone, cylinder, capsule. GG uses Z-up
  private transformPrimitiveZUp(object: Object3D): Group {
    object.rotateX(Math.PI / 2);
    const group = new Group();
    group.add(object);
    return group;
  }
  createBox(dimensions: Point3, material: Material = this.getRandomMaterial()): Gg3dObject {
    return new Gg3dObject(new Mesh(new BoxGeometry(dimensions.x, dimensions.y, dimensions.z), material));
  }
  createCapsule(radius: number, centersDistance: number, material: Material = this.getRandomMaterial()): Gg3dObject {
    return new Gg3dObject(this.transformPrimitiveZUp(new Mesh(new CapsuleGeometry(radius, centersDistance), material)));
  }
  createCylinder(radius: number, height: number, material: Material = this.getRandomMaterial()): Gg3dObject {
    return new Gg3dObject(this.transformPrimitiveZUp(new Mesh(new CylinderGeometry(radius, radius, height), material)));
  }
  createCone(radius: number, height: number, material: Material = this.getRandomMaterial()): Gg3dObject {
    return new Gg3dObject(this.transformPrimitiveZUp(new Mesh(new ConeGeometry(radius, height), material)));
  }
  createSphere(radius: number, material: Material = this.getRandomMaterial()): Gg3dObject {
    return new Gg3dObject(new Mesh(new SphereGeometry(radius), material));
  }
}
