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
import {
  extendThreeParticleVertexShader,
  THREE_PARTICLE_VERTEX_HOOKS,
  THREE_PARTICLE_VERTEX_SHADER,
  ThreeParticleSystemComponent,
} from '../../src/components/three-particle-system.component';
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
    camera.quaternion.set(
      ...(Object.values(Qtrn.lookAt({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })) as [number, number, number, number]),
    );
    camera.updateMatrixWorld();
    system.nativeMesh.updateMatrixWorld();
    system.prepareForCamera(camera);
    expect(system.nativeGeometry.instanceCount).toBe(3);
    expect(centers(system)).toEqual([5, 3, 1]);
    // looking the other way from x = 10, x = 1 is the farthest
    camera.position.set(10, 0, 0);
    camera.quaternion.set(
      ...(Object.values(Qtrn.lookAt({ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })) as [number, number, number, number]),
    );
    camera.updateMatrixWorld();
    system.prepareForCamera(camera);
    expect(centers(system)).toEqual([1, 3, 5]);
  });

  it('fills the anchor attribute from the buffers, in the sorted order', () => {
    const system = factory.createParticleSystem({ capacity: 8 });
    const frames = [
      { x: 0, y: 0, width: 1, height: 1 },
      { x: 0, y: 0, width: 1, height: 1, anchor: { x: 0.25, y: 0 } },
    ];
    const simulation = new ParticleSimulation<Point3>(8, 3, { lifetime: 10, frames, anchor: { x: 0.5, y: 1 } });
    simulation.emit(1, p => (p.position = { x: 1, y: 0, z: 0 }));
    simulation.emit(1, p => {
      p.position = { x: 5, y: 0, z: 0 };
      p.frame = 1;
    });
    system.setParticles(simulation.writeRenderBuffers());
    const anchors = () => {
      const attr = system.nativeGeometry.getAttribute('particleAnchor');
      expect(attr.itemSize).toBe(2);
      return [0, 1].map(i => [attr.getX(i), attr.getY(i)]);
    };
    system.prepareForCamera(new PerspectiveCamera());
    // the default camera at the origin looks along -Z: both at depth 0, spawn order kept
    expect(centers(system)).toEqual([1, 5]);
    expect(anchors()).toEqual([
      [0.5, 1],
      [0.25, 0],
    ]);
    const camera = new PerspectiveCamera();
    camera.quaternion.set(
      ...(Object.values(Qtrn.lookAt({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })) as [number, number, number, number]),
    );
    camera.updateMatrixWorld();
    system.nativeMesh.updateMatrixWorld();
    system.prepareForCamera(camera);
    expect(centers(system)).toEqual([5, 1]);
    expect(anchors()).toEqual([
      [0.25, 0],
      [0.5, 1],
    ]);
  });

  it('offsets the quad by the anchor before rotating it', () => {
    const shader = (factory.createParticleSystem({ capacity: 1 }).nativeMaterial as ShaderMaterial).vertexShader;
    expect(shader).toContain('attribute vec2 particleAnchor;');
    const cornerLine = shader.split('\n').find(l => l.trim().startsWith('vec2 corner ='))!;
    expect(cornerLine.trim()).toBe(
      'vec2 corner = (position.xy + vec2(0.5 - particleAnchor.x, particleAnchor.y - 0.5)) * particleSize;',
    );
    // the same expression in JS: the anchor lands on the center, the quad's other corners around it
    const corner = (px: number, py: number, ax: number, ay: number) => [(px + 0.5 - ax) * 2, (py + ay - 0.5) * 4];
    // bottom-center anchor: the bottom edge (y = -0.5) through the center, the sprite above it
    expect(corner(0, -0.5, 0.5, 1)).toEqual([0, 0]);
    expect(corner(0.5, 0.5, 0.5, 1)).toEqual([1, 4]);
    // top-left anchor: the sprite to the right and below
    expect(corner(-0.5, 0.5, 0, 0)).toEqual([0, 0]);
    expect(corner(0.5, -0.5, 0, 0)).toEqual([2, -4]);
    // rotation comes after the offset, so the sprite turns around its anchor
    expect(shader.indexOf('vec2 corner =')).toBeLessThan(shader.indexOf('float c = cos(particleRotation);'));
  });

  it('inserts app code at the stable vertex shader hooks', () => {
    const system = factory.createParticleSystem({
      capacity: 1,
      material: m =>
        extendThreeParticleVertexShader(
          extendThreeParticleVertexShader(m, {
            declarations: 'uniform float uLift;',
            mainEnd: 'gl_Position.y += uLift;',
          }),
          { mainEnd: 'gl_Position.x += $1.0;' },
        ),
    });
    const material = system.nativeMaterial as ShaderMaterial;
    const shader = material.vertexShader;
    expect(material.version).toBeGreaterThan(0);
    expect(shader.indexOf('uniform float uLift;')).toBeLessThan(shader.indexOf('void main()'));
    expect(shader.indexOf('uniform float uLift;')).toBeGreaterThan(shader.indexOf('varying vec4 vExtra;'));
    const lift = shader.indexOf('gl_Position.y += uLift;');
    expect(lift).toBeGreaterThan(shader.indexOf('#include <fog_vertex>'));
    // later code goes after earlier code, both before the marker, which stays; `$` is kept as is
    expect(shader.indexOf('gl_Position.x += $1.0;')).toBeGreaterThan(lift);
    expect(shader.indexOf(THREE_PARTICLE_VERTEX_HOOKS.mainEnd)).toBeGreaterThan(lift);
    expect(shader.lastIndexOf('}')).toBeGreaterThan(shader.indexOf(THREE_PARTICLE_VERTEX_HOOKS.mainEnd));
    expect(THREE_PARTICLE_VERTEX_SHADER).toContain(THREE_PARTICLE_VERTEX_HOOKS.declarations);
    expect(() => extendThreeParticleVertexShader(new ShaderMaterial(), { mainEnd: 'x' })).toThrow(
      /gg:particle-vertex-main-end/,
    );
    // nothing to insert, nothing required
    expect(() => extendThreeParticleVertexShader(new ShaderMaterial(), {})).not.toThrow();
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
