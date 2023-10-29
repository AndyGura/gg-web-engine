import { IDisplayObject3dComponentFactory, Shape3DDescriptor } from '@gg-web-engine/core';
import {
  BoxGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
} from 'three';
import { ThreeDisplayObjectComponent } from './components/three-display-object.component';

export class ThreeFactory extends IDisplayObject3dComponentFactory<ThreeDisplayObjectComponent> {
  getRandomMaterial(): Material {
    return new MeshBasicMaterial({
      color:
        (Math.floor(Math.random() * 256) << 16) |
        (Math.floor(Math.random() * 256) << 8) |
        Math.floor(Math.random() * 256),
    });
  }

  // most three.js primitives are designed to use Y as up coordinate, like cone, cylinder, capsule. GG uses Z-up
  private transformPrimitiveZUp(object: Object3D): Group {
    object.rotateX(Math.PI / 2);
    const group = new Group();
    group.add(object);
    return group;
  }

  createPrimitive(
    descriptor: Shape3DDescriptor,
    material: Material = this.getRandomMaterial(),
  ): ThreeDisplayObjectComponent {
    let mesh: Object3D | null = null;
    switch (descriptor.shape) {
      case 'BOX':
        mesh = new Mesh(
          new BoxGeometry(descriptor.dimensions.x, descriptor.dimensions.y, descriptor.dimensions.z),
          material,
        );
        break;
      case 'CAPSULE':
        mesh = this.transformPrimitiveZUp(
          new Mesh(new CapsuleGeometry(descriptor.radius, descriptor.centersDistance), material),
        );
        break;
      case 'CYLINDER':
        mesh = this.transformPrimitiveZUp(
          new Mesh(new CylinderGeometry(descriptor.radius, descriptor.radius, descriptor.height), material),
        );
        break;
      case 'CONE':
        mesh = this.transformPrimitiveZUp(new Mesh(new ConeGeometry(descriptor.radius, descriptor.height), material));
        break;
      case 'SPHERE':
        mesh = new Mesh(new SphereGeometry(descriptor.radius), material);
        break;
    }
    if (!mesh) {
      throw new Error(`Primitive with shape "${descriptor.shape}" not implemented`);
    }
    return new ThreeDisplayObjectComponent(mesh);
  }
}
