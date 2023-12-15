import { DisplayObject3dOpts, IDisplayObject3dComponentFactory, Shape3DDescriptor } from '@gg-web-engine/core';
import {
  BoxGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  SphereGeometry,
  Texture,
} from 'three';
import { ThreeDisplayObjectComponent } from './components/three-display-object.component';
import { ThreeVisualTypeDocRepo } from './types';
import { ThreeCameraComponent } from './components/three-camera.component';

export type ThreeDisplayObject3dOpts = DisplayObject3dOpts<Texture>;

export class ThreeFactory extends IDisplayObject3dComponentFactory<ThreeVisualTypeDocRepo> {
  createMaterial(descr: ThreeDisplayObject3dOpts): Material {
    let color = descr.color || super.randomColor();
    let shading = descr.shading || 'unlit';
    switch (shading) {
      case 'unlit':
        return new MeshBasicMaterial({
          color,
          map: descr.diffuse,
        });
      case 'standart':
        return new MeshStandardMaterial({
          color,
          map: descr.diffuse,
        });
      case 'phong':
        return new MeshPhongMaterial({
          color,
          map: descr.diffuse,
        });
      default:
        throw new Error(`"${shading}" shading not implemented for three.js`);
    }
  }

  // most three.js primitives are designed to use Y as up coordinate, like cone, cylinder, capsule. GG uses Z-up
  private transformPrimitiveZUp(object: Object3D): Group {
    object.rotateX(Math.PI / 2);
    const group = new Group();
    group.add(object);
    return group;
  }

  createPrimitive(descriptor: Shape3DDescriptor, material: ThreeDisplayObject3dOpts = {}): ThreeDisplayObjectComponent {
    let mesh: Object3D | null = null;
    let threeMat = this.createMaterial(material);
    switch (descriptor.shape) {
      case 'PLANE':
        mesh = new Mesh(new PlaneGeometry(10000, 10000), threeMat);
        break;
      case 'BOX':
        mesh = new Mesh(
          new BoxGeometry(descriptor.dimensions.x, descriptor.dimensions.y, descriptor.dimensions.z),
          threeMat,
        );
        break;
      case 'CAPSULE':
        mesh = this.transformPrimitiveZUp(
          new Mesh(new CapsuleGeometry(descriptor.radius, descriptor.centersDistance), threeMat),
        );
        break;
      case 'CYLINDER':
        mesh = this.transformPrimitiveZUp(
          new Mesh(new CylinderGeometry(descriptor.radius, descriptor.radius, descriptor.height), threeMat),
        );
        break;
      case 'CONE':
        mesh = this.transformPrimitiveZUp(new Mesh(new ConeGeometry(descriptor.radius, descriptor.height), threeMat));
        break;
      case 'SPHERE':
        mesh = new Mesh(new SphereGeometry(descriptor.radius), threeMat);
        break;
    }
    if (!mesh) {
      throw new Error(`Primitive with shape "${descriptor.shape}" not implemented`);
    }
    if (material.castShadow !== undefined) {
      mesh.castShadow = material.castShadow;
    }
    if (material.receiveShadow !== undefined) {
      mesh.receiveShadow = material.receiveShadow;
    }
    return new ThreeDisplayObjectComponent(mesh);
  }

  createPerspectiveCamera(
    settings: {
      fov?: number;
      aspectRatio?: number;
      frustrum?: { near: number; far: number };
    } = {},
  ): ThreeCameraComponent {
    return new ThreeCameraComponent(
      new PerspectiveCamera(
        settings.fov || 75,
        settings.aspectRatio || 1,
        settings.frustrum ? settings.frustrum.near : 1,
        settings.frustrum ? settings.frustrum.far : 10000,
      ),
    );
  }
}
