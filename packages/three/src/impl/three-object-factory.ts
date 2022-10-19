import { Gg3dObject, Gg3dObjectFactory } from '@gg-web-engine/core';
import { BoxGeometry, Material, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import { Three3dObject } from './three-3d-object';

export class ThreeObjectFactory implements Gg3dObjectFactory {
  getRandomMaterial(): Material {
    return new MeshBasicMaterial(
      { color: Math.floor(Math.random() * 256) << 16 | Math.floor(Math.random() * 256) << 8 | Math.floor(Math.random() * 256) }
    );
  }
  createBox(width: number, length: number, height: number, material: Material = this.getRandomMaterial()): Three3dObject {
    return new Three3dObject(new Mesh(new BoxGeometry(width, length, height), material));
  }

  createSphere(radius: number, material: Material = this.getRandomMaterial()): Gg3dObject {
    return new Three3dObject(new Mesh(new SphereGeometry(radius), material));
  }
}
