import { Color, DirectionalLight, Fog, FogExp2, HemisphereLight, OrthographicCamera, Texture, Vector3 } from 'three';
import { ThreeLightComponent } from '../../src/components/three-light.component';
import { ThreeSceneComponent } from '../../src/components/three-scene.component';

describe('ThreeLightComponent', () => {
  it('aims a directional light along its local -Z axis', () => {
    const light = ThreeLightComponent.create({ type: 'DIRECTIONAL' });
    const native = light.nativeLight as DirectionalLight;
    light.position = { x: 1, y: 2, z: 3 };
    native.updateMatrixWorld(true);
    const target = native.target.getWorldPosition(new Vector3());
    expect(target.x).toBeCloseTo(1);
    expect(target.y).toBeCloseTo(2);
    expect(target.z).toBeCloseTo(2);
  });

  it('applies shadow settings', () => {
    const light = ThreeLightComponent.create({
      type: 'DIRECTIONAL',
      castShadow: true,
      shadow: { mapSize: 2048, area: 20, near: 1, far: 300, bias: -0.001 },
    });
    const shadow = light.nativeShadow!;
    const camera = shadow.camera as OrthographicCamera;
    expect(light.castShadow).toBe(true);
    expect(shadow.mapSize.x).toBe(2048);
    expect(shadow.bias).toBe(-0.001);
    expect([camera.left, camera.right, camera.top, camera.bottom, camera.near, camera.far]).toEqual([
      -20, 20, 20, -20, 1, 300,
    ]);
  });

  it('reports its live settings in lightOptions, and clones from them', () => {
    const light = ThreeLightComponent.create({ type: 'SPOT', color: 0xff8800, angle: 0.5, distance: 7 });
    light.intensity = 3;
    light.color = 0x00ff00;
    expect(light.lightOptions).toEqual({
      type: 'SPOT',
      color: 0x00ff00,
      intensity: 3,
      distance: 7,
      decay: 2,
      angle: 0.5,
      penumbra: 0,
      castShadow: false,
    });
    light.position = { x: 4, y: 5, z: 6 };
    const clone = light.clone();
    expect(clone.lightOptions).toEqual(light.lightOptions);
    expect(clone.position).toEqual({ x: 4, y: 5, z: 6 });
  });

  it('points a hemisphere light sky direction along its rotated +Z, ignoring position', () => {
    const light = ThreeLightComponent.create({ type: 'HEMISPHERE' });
    const native = light.nativeLight as HemisphereLight;
    expect(native.position.toArray()).toEqual([0, 0, 1]);
    light.position = { x: 100, y: 0, z: 0 };
    expect(native.position.toArray()).toEqual([0, 0, 1]);
    light.rotation = { x: Math.sin(Math.PI / 4), y: 0, z: 0, w: Math.cos(Math.PI / 4) }; // 90 deg about X
    expect(native.position.y).toBeCloseTo(-1);
    expect(native.position.z).toBeCloseTo(0);
  });

  it('ignores castShadow on lights that cannot cast shadows', () => {
    const light = ThreeLightComponent.create({ type: 'AMBIENT' });
    light.castShadow = true;
    expect(light.castShadow).toBe(false);
  });
});

describe('ThreeSceneComponent environment', () => {
  it('applies and merges background, environment map and fog', async () => {
    const scene = new ThreeSceneComponent();
    await scene.init();
    const native = scene.nativeScene!;
    scene.setEnvironment({ background: 0x112233, fog: { type: 'LINEAR', color: 0xffffff, near: 10, far: 100 } });
    expect((native.background as Color).getHex()).toBe(0x112233);
    expect(native.fog).toBeInstanceOf(Fog);

    const panorama = new Texture();
    scene.setEnvironment({ environmentMap: panorama, fog: { type: 'EXPONENTIAL', color: 0, density: 0.01 } });
    expect(native.environment).toBe(panorama);
    expect(native.environmentRotation.x).toBeCloseTo(Math.PI / 2);
    expect((native.background as Color).getHex()).toBe(0x112233);
    expect(native.fog).toBeInstanceOf(FogExp2);

    scene.setEnvironment({ background: null, environmentMap: null, fog: null });
    expect(native.background).toBeNull();
    expect(native.environment).toBeNull();
    expect(native.fog).toBeNull();
  });
});
