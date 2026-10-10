import {
  AdditiveBlending,
  CustomBlending,
  MultiplyBlending,
  NormalBlending,
  OneFactor,
  PerspectiveCamera,
  ShaderMaterial,
  Texture,
} from 'three';
import { Gg3dWorld, ParticleSimulation, Point3, Qtrn, ParticleSystem3dEntity } from '@gg-web-engine/core';
import { ThreeFactory } from '../../src/three-factory';
import { ThreeSceneComponent } from '../../src/components/three-scene.component';
import { ThreeParticleSystemComponent } from '../../src/components/three-particle-system.component';
import { ThreeGgWorld } from '../../src/types';

const centers = (system: ThreeParticleSystemComponent): number[] => {
  const attr = system.nativeGeometry.getAttribute('particleCenter');
  const result: number[] = [];
  for (let i = 0; i < system.nativeGeometry.instanceCount; i++) {
    result.push(attr.getX(i));
  }
  return result;
};

const simulationWithXs = (xs: number[], capacity = 8) => {
  const simulation = new ParticleSimulation<Point3>(capacity, 3, { lifetime: 10 });
  for (const x of xs) {
    simulation.emit(1, p => (p.position = { x, y: 0, z: 0 }));
  }
  return simulation.writeRenderBuffers();
};

describe('ThreeParticleSystemComponent', () => {
  const factory = new ThreeFactory();

  it('builds one instanced quad mesh that never casts shadows or gets culled', () => {
    const system = factory.createParticleSystem({ capacity: 32 });
    expect(system).toBeInstanceOf(ThreeParticleSystemComponent);
    expect(system.capacity).toBe(32);
    expect(system.nativeMesh.frustumCulled).toBe(false);
    expect(system.nativeGeometry.instanceCount).toBe(0);
    expect(system.nativeGeometry.getAttribute('particleColor').count).toBe(32);
    system.castShadow = true;
    expect(system.castShadow).toBe(false);
    expect(system.nativeMesh.castShadow).toBe(false);
  });

  it('maps blend modes and depth options onto the material', () => {
    const material = (o: object) =>
      factory.createParticleSystem({ capacity: 1, ...o }).nativeMaterial as ShaderMaterial;
    expect(material({}).blending).toBe(NormalBlending);
    expect(material({}).depthWrite).toBe(false);
    expect(material({}).depthTest).toBe(true);
    expect(material({}).premultipliedAlpha).toBe(true);
    expect(material({ blending: 'additive' }).blending).toBe(AdditiveBlending);
    expect(material({ blending: 'additive' }).defines.GG_FOG_FADE).toBe('');
    expect(material({ blending: 'multiply' }).blending).toBe(MultiplyBlending);
    expect(material({ blending: 'premultiplied' }).defines.GG_PREMULTIPLIED_INPUT).toBe('');
    expect(material({ textureAlpha: 'brightness' }).defines.GG_TEXTURE_ALPHA_BRIGHTNESS).toBe('');
    expect(material({ billboard: 'vertical' }).defines.GG_BILLBOARD_VERTICAL).toBe('');
    expect(material({ depthWrite: true, depthTest: false }).depthWrite).toBe(true);
  });

  it('lets the app adjust or replace the material', () => {
    const adjusted = factory.createParticleSystem({
      capacity: 1,
      material: m => {
        m.blending = CustomBlending;
        m.blendSrc = OneFactor;
        return m;
      },
    });
    expect(adjusted.nativeMaterial.blending).toBe(CustomBlending);
    const replacement = new ShaderMaterial();
    const replaced = factory.createParticleSystem({ capacity: 1, material: () => replacement });
    expect(replaced.nativeMaterial).toBe(replacement);
    expect(replaced.nativeMesh.material).toBe(replacement);
  });

  it('swaps the texture and its define', () => {
    const system = factory.createParticleSystem({ capacity: 1 });
    const material = system.nativeMaterial as ShaderMaterial;
    expect(material.defines.GG_USE_MAP).toBeUndefined();
    const texture = new Texture();
    system.texture = texture;
    expect(material.uniforms.map.value).toBe(texture);
    expect(material.defines.GG_USE_MAP).toBe('');
    system.texture = null;
    expect(material.defines.GG_USE_MAP).toBeUndefined();
  });

  it('fills the instance attributes before a render, sorted back to front for that camera', () => {
    const system = factory.createParticleSystem({ capacity: 8 });
    system.setParticles(simulationWithXs([1, 5, 3]));
    const camera = new PerspectiveCamera();
    // at the origin looking along +X: x = 5 is the farthest
    camera.quaternion.set(...(Object.values(Qtrn.lookAt({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })) as [number, number, number, number]));
    camera.updateMatrixWorld();
    system.nativeMesh.updateMatrixWorld();
    system.prepareForCamera(camera);
    expect(system.nativeGeometry.instanceCount).toBe(3);
    expect(centers(system)).toEqual([5, 3, 1]);
    // looking the other way from x = 10, x = 1 is the farthest
    camera.position.set(10, 0, 0);
    camera.quaternion.set(...(Object.values(Qtrn.lookAt({ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })) as [number, number, number, number]));
    camera.updateMatrixWorld();
    system.prepareForCamera(camera);
    expect(centers(system)).toEqual([1, 3, 5]);
  });

  it('keeps spawn order with sorting off', () => {
    const system = factory.createParticleSystem({ capacity: 8, sort: false });
    system.setParticles(simulationWithXs([1, 5, 3]));
    system.prepareForCamera(new PerspectiveCamera());
    expect(centers(system)).toEqual([1, 5, 3]);
  });

  it('rejects buffers larger than its capacity', () => {
    const system = factory.createParticleSystem({ capacity: 2 });
    expect(() => system.setParticles(simulationWithXs([1], 4))).toThrow();
  });

  it('sorts through the scene hook on every render of a world and unhooks on removal', async () => {
    const scene = new ThreeSceneComponent();
    const world: ThreeGgWorld = new Gg3dWorld({ visualScene: scene });
    await world.init();
    const entity = world.addParticleSystem({ capacity: 4 }, { lifetime: 10 });
    expect(entity).toBeInstanceOf(ParticleSystem3dEntity);
    expect(scene.nativeScene!.children).toContain(entity.particleSystem.nativeMesh);
    expect(scene.beforeRenderHooks.size).toBe(1);
    entity.emit(2, (p, ctx) => (p.position = { x: ctx.index, y: 0, z: 0 }));
    entity.update(0);
    const camera = new PerspectiveCamera();
    scene.nativeScene!.onBeforeRender(null as any, scene.nativeScene!, camera, null as any, null as any, null as any);
    expect(entity.particleSystem.nativeGeometry.instanceCount).toBe(2);
    world.removeEntity(entity, true);
    expect(scene.beforeRenderHooks.size).toBe(0);
    expect(scene.nativeScene!.children).not.toContain(entity.particleSystem.nativeMesh);
    world.dispose();
  });

  it('clones into an independent empty system with the same options', () => {
    const texture = new Texture();
    const system = factory.createParticleSystem({ capacity: 3, texture, blending: 'additive' });
    system.setParticles(simulationWithXs([1], 3));
    system.prepareForCamera(new PerspectiveCamera());
    const copy = system.clone();
    expect(copy).not.toBe(system);
    expect(copy.capacity).toBe(3);
    expect(copy.texture).toBe(texture);
    expect(copy.nativeGeometry).not.toBe(system.nativeGeometry);
    expect(copy.nativeGeometry.instanceCount).toBe(0);
  });
});
