import { CanvasTexture, Material, Mesh, NearestFilter, RepeatWrapping } from 'three';
import { ThreeFactory } from '../src/three-factory';

describe('ThreeFactory', () => {
  const factory = new ThreeFactory();

  it('makes a material transparent when opacity is below 1', () => {
    const box = factory.createBox({ x: 1, y: 1, z: 1 }, { color: 0xff0000, opacity: 0.4 });
    const material = (box.nativeMesh as Mesh).material as Material;
    expect(material.opacity).toBe(0.4);
    expect(material.transparent).toBe(true);
  });

  it('keeps a material opaque by default', () => {
    const box = factory.createBox({ x: 1, y: 1, z: 1 }, { color: 0xff0000 });
    const material = (box.nativeMesh as Mesh).material as Material;
    expect(material.opacity).toBe(1);
    expect(material.transparent).toBe(false);
  });

  it('applies castShadow/receiveShadow to every part of a compound primitive', () => {
    const compound = factory.createPrimitive(
      {
        shape: 'COMPOUND',
        children: [{ shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } } }],
      },
      { castShadow: true, receiveShadow: true },
    );
    compound.nativeMesh.traverse(obj => {
      expect(obj.castShadow).toBe(true);
      expect(obj.receiveShadow).toBe(true);
    });
  });

  it('creates a canvas texture with repeat and filter options', () => {
    const texture = factory.createTextureFromCanvas(document.createElement('canvas'), {
      repeat: { x: 5, y: 3 },
      filter: 'nearest',
    });
    expect(texture).toBeInstanceOf(CanvasTexture);
    expect(texture.wrapS).toBe(RepeatWrapping);
    expect(texture.wrapT).toBe(RepeatWrapping);
    expect(texture.repeat.x).toBe(5);
    expect(texture.repeat.y).toBe(3);
    expect(texture.magFilter).toBe(NearestFilter);
  });
});
