import { Mesh, ShaderMaterial, Texture, WebGLRenderer } from 'three';
import { ThreeSceneComponent } from '../../src';

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
});
