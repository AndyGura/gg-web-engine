import {
  DisplayObject3dOpts,
  LoadTextureOptions,
  getCylinderRadii,
  IDisplayObject3dComponentFactory,
  Light3dDescriptor,
  ParticleSystem3dRenderOptions,
  Pnt3,
  Qtrn,
  Shape3DMeshDescriptor,
} from '@gg-web-engine/core';
import {
  BoxGeometry,
  CanvasTexture,
  SRGBColorSpace,
  BufferGeometry,
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
  Vector3,
} from 'three';
import { ThreeDisplayObjectComponent } from './components/three-display-object.component';
import { ThreeVisualTypeDocRepo } from './types';
import { ThreeCameraComponent } from './components/three-camera.component';
import { ThreeLightComponent } from './components/three-light.component';
import { applyTextureOptions } from './utils/texture-options';
import {
  ThreeParticleSystemComponent,
  ThreeParticleSystemExtraOpts,
} from './components/three-particle-system.component';

export type ThreeDisplayObject3dOpts = DisplayObject3dOpts<Texture>;

export class ThreeFactory extends IDisplayObject3dComponentFactory<ThreeVisualTypeDocRepo> {
  createMaterial(descr: ThreeDisplayObject3dOpts): Material {
    let color: {} | { color: number } = {};
    if (descr.color) {
      color = { color: descr.color };
    } else if (!descr.diffuse) {
      color = { color: super.randomColor() };
    }
    if (descr.opacity !== undefined && descr.opacity < 1) {
      color = { ...color, opacity: descr.opacity, transparent: true };
    }
    let shading = descr.shading || 'unlit';
    switch (shading) {
      case 'unlit':
        return new MeshBasicMaterial({
          ...color,
          map: descr.diffuse || null,
        });
      case 'standart':
        return new MeshStandardMaterial({
          ...color,
          map: descr.diffuse || null,
        });
      case 'phong':
        return new MeshPhongMaterial({
          ...color,
          map: descr.diffuse || null,
        });
      case 'wireframe':
        return new MeshBasicMaterial({
          ...color,
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
      case 'CYLINDER': {
        const { radiusX, radiusY } = getCylinderRadii(descriptor);
        const cylinderGeometry = new CylinderGeometry(
          1,
          1,
          descriptor.height,
          descriptor.radialSegments,
          descriptor.heightSegments,
        );
        cylinderGeometry.scale(radiusX, 1, radiusY);
        mesh = new Mesh(cylinderGeometry, threeMat);
        this.transformPrimitiveZUp(mesh as Mesh);
        break;
      }
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
      case 'MESH':
        const geometry = new BufferGeometry();
        geometry.setFromPoints(descriptor.vertices.map(x => new Vector3(...Pnt3.spr(x))));
        geometry.setIndex(
          descriptor.faces.reduce((p, c) => {
            p.push(...c);
            return p;
          }, [] as number[]),
        );
        mesh = new Mesh(geometry, threeMat);
        break;
    }
    if (!mesh) {
      throw new Error(`Primitive with shape "${descriptor.shape}" not implemented`);
    }
    const result = new ThreeDisplayObjectComponent(mesh, material);
    if (material.castShadow !== undefined) {
      result.castShadow = material.castShadow;
    }
    if (material.receiveShadow !== undefined) {
      result.receiveShadow = material.receiveShadow;
    }
    return result;
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

  createLight(descriptor: Light3dDescriptor): ThreeLightComponent {
    return ThreeLightComponent.create(descriptor);
  }

  createParticleSystem(
    options: ParticleSystem3dRenderOptions<Texture> & Partial<ThreeParticleSystemExtraOpts>,
  ): ThreeParticleSystemComponent {
    return new ThreeParticleSystemComponent(options);
  }

  createTextureFromCanvas(canvas: HTMLCanvasElement, options: LoadTextureOptions = {}): Texture {
    const texture = new CanvasTexture(canvas);
    // canvas pixels are sRGB, same as an image file's
    texture.colorSpace = SRGBColorSpace;
    return applyTextureOptions(texture, options);
  }
}
