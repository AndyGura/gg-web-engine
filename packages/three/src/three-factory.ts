import {
  DisplayObject3dOpts,
  IDisplayObject3dComponentFactory,
  Pnt3,
  Qtrn,
  Shape3DMeshDescriptor,
} from '@gg-web-engine/core';
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
          map: descr.diffuse || null,
        });
      case 'standart':
        return new MeshStandardMaterial({
          color,
          map: descr.diffuse || null,
        });
      case 'phong':
        return new MeshPhongMaterial({
          color,
          map: descr.diffuse || null,
        });
      case 'wireframe':
        return new MeshBasicMaterial({
          color,
          wireframe: true,
        });
      default:
        throw new Error(`"${shading}" shading not implemented for three.js`);
    }
  }

  // most three.js primitives are designed to use Y as up coordinate, like cone, cylinder, capsule. GG uses Z-up
  private transformPrimitiveZUp(object: Mesh): void {
    object.geometry.rotateX(Math.PI / 2);
  }

  createPrimitive(
    descriptor: Shape3DMeshDescriptor,
    material: ThreeDisplayObject3dOpts = {},
  ): ThreeDisplayObjectComponent {
    let mesh: Object3D | null = null;
    let threeMat = this.createMaterial(material);
    switch (descriptor.shape) {
      case 'PLANE':
        mesh = new Mesh(
          new PlaneGeometry(
            descriptor.dimensions?.x || 10000,
            descriptor.dimensions?.y || 10000,
            descriptor.segments?.x,
            descriptor.segments?.y,
          ),
          threeMat,
        );
        break;
      case 'BOX':
        mesh = new Mesh(
          new BoxGeometry(
            ...Pnt3.spr(descriptor.dimensions),
            ...(descriptor.segments ? Pnt3.spr(descriptor.segments) : []),
          ),
          threeMat,
        );
        break;
      case 'CAPSULE':
        mesh = new Mesh(
          new CapsuleGeometry(
            descriptor.radius,
            descriptor.centersDistance,
            descriptor.capSegments,
            descriptor.radialSegments,
          ),
          threeMat,
        );
        this.transformPrimitiveZUp(mesh as Mesh);
        break;
      case 'CYLINDER':
        mesh = new Mesh(
          new CylinderGeometry(
            descriptor.radius,
            descriptor.radius,
            descriptor.height,
            descriptor.radialSegments,
            descriptor.heightSegments,
          ),
          threeMat,
        );
        this.transformPrimitiveZUp(mesh as Mesh);
        break;
      case 'CONE':
        mesh = new Mesh(
          new ConeGeometry(descriptor.radius, descriptor.height, descriptor.radialSegments, descriptor.heightSegments),
          threeMat,
        );
        this.transformPrimitiveZUp(mesh as Mesh);
        break;
      case 'SPHERE':
        mesh = new Mesh(
          new SphereGeometry(descriptor.radius, descriptor.widthSegments, descriptor.heightSegments),
          threeMat,
        );
        this.transformPrimitiveZUp(mesh as Mesh);
        break;
      case 'COMPOUND':
        mesh = new Group();
        for (const { position, rotation, shape } of descriptor.children) {
          const submesh = this.createPrimitive(shape, material).nativeMesh;
          if (position) {
            submesh.position.set(...Pnt3.spr(position));
          }
          if (rotation) {
            submesh.quaternion.set(...Qtrn.spr(rotation));
          }
          mesh.add(submesh);
        }
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
