import {
  BoxGeometry,
  CubeCamera,
  Mesh,
  MeshDepthMaterial,
  PMREMGenerator,
  ShaderMaterial,
  Texture,
  Vector3,
  WebGLCubeRenderTarget,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { Frame3d, PROCEDURAL_SKY_DEFAULTS } from '@gg-web-engine/core';

const PROCEDURAL_DEFAULTS = PROCEDURAL_SKY_DEFAULTS;
import { ThreeProceduralSky, ThreeSceneComponent } from '../../src';

const skyMesh = (scene: ThreeSceneComponent) => scene.nativeScene!.getObjectByName('gg-procedural-sky') as Mesh | undefined;

describe('procedural sky', () => {
  it('draws a dynamic sky as a box at the far plane, with the settings as uniforms', async () => {
    const scene = new ThreeSceneComponent();
    await scene.init();
    scene.setEnvironment({ background: { type: 'PROCEDURAL', timeOfDay: 12, haze: 0.7, clouds: { coverage: 1 } } });
    const mesh = skyMesh(scene)!;
    expect(mesh).toBeDefined();
    expect(scene.nativeScene!.background).toBeNull();
    const material = mesh.material as ShaderMaterial;
    expect(material.depthTest).toBe(false);
    expect(material.uniforms.uHaze.value).toBe(0.7);
    expect(material.uniforms.uCoverage.value).toBe(1);
    expect(material.uniforms.uSunDirection.value.z).toBeCloseTo(Math.sin(Math.PI / 3));
    // the sky never takes part in raycasts
    expect(mesh.raycast).not.toBe(Mesh.prototype.raycast);

    // a change updates the same mesh
    scene.setEnvironment({ background: { type: 'PROCEDURAL', clouds: null } });
    expect(skyMesh(scene)).toBe(mesh);
    expect(material.uniforms.uCoverage.value).toBe(0);
  });

  it('turns the cirrus layer on and off, its streaks along its wind', async () => {
    const scene = new ThreeSceneComponent();
    await scene.init();
    scene.setEnvironment({ background: { type: 'PROCEDURAL' } });
    const u = (skyMesh(scene)!.material as ShaderMaterial).uniforms;
    expect(u.uCirrusCoverage.value).toBe(0);
    scene.setEnvironment({ background: { type: 'PROCEDURAL', cirrus: { coverage: 0.7, wind: { x: 0, y: 0.01 } } } });
    expect(u.uCirrusCoverage.value).toBe(0.7);
    expect(u.uCirrusAxis.value.x).toBeCloseTo(0);
    expect(u.uCirrusAxis.value.y).toBeCloseTo(1);
    scene.setEnvironment({ background: { type: 'PROCEDURAL', cirrus: null } });
    expect(u.uCirrusCoverage.value).toBe(0);
  });

  it('removes the sky and frees it when the background becomes something else', async () => {
    const scene = new ThreeSceneComponent();
    await scene.init();
    scene.setEnvironment({ background: { type: 'PROCEDURAL' } });
    const material = skyMesh(scene)!.material as ShaderMaterial;
    const dispose = jest.spyOn(material, 'dispose');
    scene.setEnvironment({ background: 0x334455 });
    expect(skyMesh(scene)).toBeUndefined();
    expect(dispose).toHaveBeenCalled();
  });

  it('a baked sky leaves the scene and is set as background by the next frame', async () => {
    const scene = new ThreeSceneComponent();
    await scene.init();
    scene.setEnvironment({ background: { type: 'PROCEDURAL', mode: 'BAKED', bakeResolution: 64 } });
    expect(skyMesh(scene)).toBeUndefined();
    const baked = new Texture();
    const bake = jest.spyOn((scene as any).backgroundSky, 'bake').mockReturnValue(baked);
    scene.prepareFrame({} as WebGLRenderer);
    expect(bake).toHaveBeenCalledWith(expect.anything(), 64);
    expect(scene.nativeScene!.background).toBe(baked);
    expect(scene.nativeScene!.backgroundRotation.x).toBe(0);
  });

  it('a procedural environment map is set from its baked, prefiltered cube', async () => {
    const scene = new ThreeSceneComponent();
    await scene.init();
    scene.setEnvironment({ environmentMap: { type: 'PROCEDURAL' } });
    const lighting = new Texture();
    const bake = jest.spyOn((scene as any).environmentSky, 'bakeEnvironment').mockReturnValue(lighting);
    scene.prepareFrame({} as WebGLRenderer);
    expect(bake).toHaveBeenCalled();
    expect(scene.nativeScene!.environment).toBe(lighting);
    scene.setEnvironment({ environmentMap: null });
    expect((scene as any).environmentSky).toBeNull();
    expect(scene.nativeScene!.environment).toBeNull();
  });

  it('keeps a procedural sky globally in place across a frame switch', async () => {
    const scene = new ThreeSceneComponent();
    await scene.init();
    scene.setEnvironment({ background: { type: 'PROCEDURAL' }, environmentMap: { type: 'PROCEDURAL' } });
    const u = (skyMesh(scene)!.material as ShaderMaterial).uniforms;
    const delta = new Frame3d({ x: 100, y: -20, z: 0 }, 1.1);
    scene.onFrameSwitch(delta);
    // the shader turns a view direction of the scene into the global one the sky's settings use
    const global = new Vector3(0.3, -0.8, 0.52).normalize();
    const d = delta.toGlobalDirection(global);
    const local = new Vector3(d.x, d.y, d.z);
    expect(local.clone().applyMatrix3(u.uFrameRotation.value).distanceTo(global)).toBeLessThan(1e-9);
    const envU = (scene as any).environmentSky.material.uniforms;
    expect(local.clone().applyMatrix3(envU.uFrameRotation.value).distanceTo(global)).toBeLessThan(1e-9);
    // the baked cube is drawn in the scene's own space, so three.js must not turn it again
    expect(scene.nativeScene!.backgroundRotation.z).toBe(0);
    expect(scene.nativeScene!.environmentRotation.z).toBe(0);
    // a sky set after the switch is turned the same way
    scene.setEnvironment({ background: 0x112233 });
    scene.setEnvironment({ background: { type: 'PROCEDURAL' } });
    const fresh = (skyMesh(scene)!.material as ShaderMaterial).uniforms;
    expect(local.clone().applyMatrix3(fresh.uFrameRotation.value).distanceTo(global)).toBeLessThan(1e-9);
  });

  describe('bakes', () => {
    const fakeRenderer = () => ({ domElement: new EventTarget() }) as unknown as WebGLRenderer;
    let update: jest.SpyInstance;
    let fromCubemap: jest.SpyInstance;
    beforeEach(() => {
      update = jest.spyOn(CubeCamera.prototype, 'update').mockImplementation(() => {});
      fromCubemap = jest.spyOn(PMREMGenerator.prototype, 'fromCubemap').mockImplementation(() => new WebGLRenderTarget());
    });
    afterEach(() => jest.restoreAllMocks());

    it('keeps one bake per renderer, drawn again only on a change or a restored context', () => {
      const sky = new ThreeProceduralSky();
      sky.setOptions({ ...PROCEDURAL_DEFAULTS });
      const a = fakeRenderer();
      const b = fakeRenderer();
      const cubeA = sky.bake(a, 32);
      sky.bake(a, 32);
      expect(update).toHaveBeenCalledTimes(1);
      // a second renderer (another WebGL context) gets its own cube
      const cubeB = sky.bake(b, 32);
      expect(update).toHaveBeenCalledTimes(2);
      expect(cubeB).not.toBe(cubeA);
      // a lost and restored context has lost the bake's contents
      a.domElement.dispatchEvent(new Event('webglcontextrestored'));
      sky.bake(a, 32);
      expect(update).toHaveBeenCalledTimes(3);
      // a setting change redraws for each renderer once
      sky.setOptions({ ...PROCEDURAL_DEFAULTS, timeOfDay: 18 });
      sky.bake(a, 32);
      sky.bake(b, 32);
      sky.bake(b, 32);
      expect(update).toHaveBeenCalledTimes(5);
      // the wind alone doesn't change a baked sky
      sky.setOptions({ ...PROCEDURAL_DEFAULTS, timeOfDay: 18, clouds: { ...PROCEDURAL_DEFAULTS.clouds!, wind: { x: 1, y: 0 } } });
      sky.bake(a, 32);
      expect(update).toHaveBeenCalledTimes(5);
    });

    it('prefilters the environment per renderer, again after a restored context', () => {
      const sky = new ThreeProceduralSky();
      sky.setOptions({ ...PROCEDURAL_DEFAULTS });
      const a = fakeRenderer();
      sky.bakeEnvironment(a, 32);
      sky.bakeEnvironment(a, 32);
      expect(fromCubemap).toHaveBeenCalledTimes(1);
      a.domElement.dispatchEvent(new Event('webglcontextrestored'));
      sky.bakeEnvironment(a, 32);
      expect(fromCubemap).toHaveBeenCalledTimes(2);
      sky.bakeEnvironment(fakeRenderer(), 32);
      expect(fromCubemap).toHaveBeenCalledTimes(3);
    });

    it('frees the bake of a renderer that left, and a replacing renderer gets a fresh one', async () => {
      const scene = new ThreeSceneComponent();
      await scene.init();
      scene.setEnvironment({ background: { type: 'PROCEDURAL', mode: 'BAKED', bakeResolution: 32 } });
      const first = fakeRenderer();
      scene.prepareFrame(first);
      const firstCube = scene.nativeScene!.background as Texture;
      const dispose = jest.spyOn(WebGLCubeRenderTarget.prototype, 'dispose');
      const removeListener = jest.spyOn(first.domElement, 'removeEventListener');
      scene.releaseRenderer(first);
      expect(dispose).toHaveBeenCalled();
      const replacement = fakeRenderer();
      scene.prepareFrame(replacement);
      expect(removeListener).toHaveBeenCalledWith('webglcontextrestored', expect.any(Function));
      expect(scene.nativeScene!.background).not.toBe(firstCube);
      expect(update).toHaveBeenCalledTimes(2);
    });
  });

  it('draws nothing in a pass that renders the scene with an override material', () => {
    const sky = new ThreeProceduralSky();
    const geometry = sky.mesh.geometry as BoxGeometry;
    const args = [{} as WebGLRenderer, {} as any, {} as any, geometry] as const;
    sky.mesh.onBeforeRender(...args, new MeshDepthMaterial(), null as any);
    expect(geometry.drawRange.count).toBe(0);
    sky.mesh.onAfterRender(...args, new MeshDepthMaterial(), null as any);
    expect(geometry.drawRange.count).toBe(Infinity);
    sky.mesh.onBeforeRender(...args, sky.material, null as any);
    expect(geometry.drawRange.count).toBe(Infinity);
  });

  it('moves the clouds by the time it is given', () => {
    const sky = new ThreeProceduralSky();
    sky.setOptions({ ...PROCEDURAL_DEFAULTS, clouds: { ...PROCEDURAL_DEFAULTS.clouds!, wind: { x: 0.01, y: 0 } } });
    const u = sky.material.uniforms;
    sky.advance(1000);
    sky.advance(1050);
    expect(u.uCloudOffset.value.x).toBeCloseTo(0.0005);
    // a paused clock gives the same time: nothing moves
    sky.advance(1050);
    expect(u.uCloudOffset.value.x).toBeCloseTo(0.0005);
  });
});
