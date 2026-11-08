// jsdom has no WebGL: three.js stays real except for WebGLRenderer, replaced by a stand-in that
// records every draw and clear, with what the drawn scene's sky looked like at that moment.
const calls: any[] = [];

jest.mock('three', () => {
  const actual = jest.requireActual('three');
  class FakeWebGLRenderer {
    shadowMap: any = {};
    domElement: HTMLCanvasElement;
    autoClear = true;
    autoClearColor = true;
    autoClearDepth = true;
    autoClearStencil = true;
    private target: any = null;
    private width = 300;
    private height = 150;
    constructor(params: { canvas?: HTMLCanvasElement }) {
      this.domElement = params.canvas ?? document.createElement('canvas');
    }
    setClearColor() {}
    setPixelRatio() {}
    getPixelRatio() {
      return 1;
    }
    setSize(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    getSize(target: any) {
      return target.set(this.width, this.height);
    }
    getRenderTarget() {
      return this.target;
    }
    setRenderTarget(target: any) {
      this.target = target;
    }
    render(scene: any, camera: any) {
      scene.onBeforeRender?.(this, scene, camera);
      calls.push({
        op: 'render',
        scene,
        camera,
        autoClear: this.autoClear,
        background: scene.background,
        rotation: scene.backgroundRotation.clone(),
        children: [...scene.children],
      });
    }
    clear() {
      calls.push({ op: 'clear' });
    }
    clearDepth() {
      calls.push({ op: 'clearDepth' });
    }
    dispose() {}
    forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

import { Color, Mesh, PerspectiveCamera, Texture } from 'three';
import { Entity3d, Frame3d, Gg3dWorld, Light3dEntity, Pnt3, Qtrn } from '@gg-web-engine/core';
import {
  ThreeComposerRendererComponent,
  ThreeGgWorld,
  ThreeProceduralSky,
  ThreeRendererComponent,
  ThreeSceneComponent,
} from '../../src';

const renders = () => calls.filter(c => c.op === 'render');

describe('backdrops (three)', () => {
  let scene: ThreeSceneComponent;
  let world: ThreeGgWorld;

  beforeEach(async () => {
    calls.length = 0;
    scene = new ThreeSceneComponent();
    world = new Gg3dWorld({ visualScene: scene });
    await world.init();
  });

  afterEach(() => {
    world.dispose();
    jest.restoreAllMocks();
  });

  const addRenderer = () => {
    const entity = world.addRenderer(scene.factory.createPerspectiveCamera(), document.createElement('canvas'), {
      size: { x: 200, y: 100 },
    });
    calls.length = 0;
    return entity;
  };

  it('createBackdropScene returns a fresh backdrop scene that refuses a background', async () => {
    const backdropScene = scene.createBackdropScene();
    expect(backdropScene).toBeInstanceOf(ThreeSceneComponent);
    expect(backdropScene).not.toBe(scene);
    expect(backdropScene.isBackdrop).toBe(true);
    expect(scene.isBackdrop).toBe(false);
    await backdropScene.init();
    expect(() => backdropScene.setEnvironment({ background: 0xff0000 })).toThrow(/no background of its own/);
    backdropScene.setEnvironment({ background: null, fog: { type: 'EXPONENTIAL', color: 0x112233, density: 0.1 } });
    expect(backdropScene.nativeScene!.fog).not.toBeNull();
    expect(scene.nativeScene!.fog).toBeNull();
  });

  it('renders in one pass without backdrops', () => {
    scene.setEnvironment({ background: 0x334455 });
    const renderer = addRenderer();
    renderer.renderer.render();
    expect(calls.map(c => c.op)).toEqual(['render']);
    expect(calls[0].scene).toBe(scene.nativeScene);
    expect(calls[0].autoClear).toBe(true);
    expect((calls[0].background as Color).getHex()).toBe(0x334455);
  });

  it('draws the backdrop with the lent sky, clears depth, then the world without its sky', async () => {
    scene.setEnvironment({ background: 0x334455 });
    const renderer = addRenderer();
    const backdrop = await world.addBackdrop({ scale: 1 / 16 });
    const own = backdrop.ownedScene as ThreeSceneComponent;
    renderer.position = { x: 32, y: 16, z: 1.6 };
    renderer.rotation = Qtrn.lookAt(renderer.position, Pnt3.O);
    calls.length = 0;

    renderer.renderer.render();

    expect(calls.map(c => c.op)).toEqual(['clear', 'render', 'clearDepth', 'render']);
    const [, backdropPass, , mainPass] = calls;
    expect(backdropPass.scene).toBe(own.nativeScene);
    expect(backdropPass.camera).toBe(backdrop.camera.nativeCamera);
    expect(backdropPass.autoClear).toBe(false);
    expect((backdropPass.background as Color).getHex()).toBe(0x334455);
    expect(mainPass.scene).toBe(scene.nativeScene);
    expect(mainPass.background).toBeNull();
    expect(mainPass.autoClear).toBe(false);
    // the backdrop camera was posed from the renderer's camera
    const p = backdrop.camera.position;
    expect(p.x).toBeCloseTo(2);
    expect(p.y).toBeCloseTo(1);
    expect(p.z).toBeCloseTo(0.1);
    expect((backdrop.camera.nativeCamera as PerspectiveCamera).aspect).toBeCloseTo(2);
    // everything put back
    expect((scene.nativeScene!.background as Color).getHex()).toBe(0x334455);
    expect(own.nativeScene!.background).toBeNull();
    expect(renderer.renderer.nativeRenderer.autoClear).toBe(true);
  });

  it('turns a texture sky by the world frame yaw for the global backdrop camera', async () => {
    const sky = new Texture();
    scene.setEnvironment({ background: sky });
    world.switchFrame(new Frame3d({ x: 10, y: 0, z: 0 }, 0.5));
    const frameYaw = scene.nativeScene!.backgroundRotation.z;
    expect(frameYaw).toBeCloseTo(-0.5);
    const renderer = addRenderer();
    const backdrop = await world.addBackdrop();
    calls.length = 0;
    renderer.renderer.render();
    const backdropPass = renders()[0];
    expect(backdropPass.scene).toBe((backdrop.ownedScene as ThreeSceneComponent).nativeScene);
    expect(backdropPass.background).toBe(sky);
    expect(backdropPass.rotation.x).toBeCloseTo(Math.PI / 2);
    // Rz(frame.yaw) * Rz(frameYaw) * Rx(PI/2): turning the sky back to global axes
    expect(backdropPass.rotation.z).toBeCloseTo(frameYaw + world.frame.yaw);
    expect(backdropPass.rotation.z).toBeCloseTo(0);
    expect(scene.nativeScene!.backgroundRotation.z).toBeCloseTo(frameYaw);
    expect(scene.nativeScene!.background).toBe(sky);
  });

  it('moves a dynamic procedural sky into the farthest backdrop for its pass', async () => {
    scene.setEnvironment({ background: { type: 'PROCEDURAL', mode: 'DYNAMIC' } });
    const skyMesh = scene.nativeScene!.children.find(c => c.name === 'gg-procedural-sky') as Mesh;
    expect(skyMesh).toBeDefined();
    world.frame = { position: Pnt3.O, yaw: 0.3 };
    const renderer = addRenderer();
    const setFrameYaw = jest.spyOn(ThreeProceduralSky.prototype, 'setFrameYaw');
    const far = await world.addBackdrop({ scale: 1 / 256 });
    const near = await world.addBackdrop({ scale: 1 / 16 });
    calls.length = 0;
    renderer.renderer.render();
    const [farPass, nearPass, mainPass] = renders();
    expect(farPass.scene).toBe((far.ownedScene as ThreeSceneComponent).nativeScene);
    expect(farPass.children).toContain(skyMesh);
    expect(nearPass.scene).toBe((near.ownedScene as ThreeSceneComponent).nativeScene);
    expect(nearPass.children).not.toContain(skyMesh);
    expect(mainPass.children).not.toContain(skyMesh);
    expect(setFrameYaw.mock.calls.map(c => c[0])).toEqual([0.3, 0]);
    expect(skyMesh.parent).toBe(scene.nativeScene);
  });

  it('lends a baked procedural sky (a cube render target) turned by the frame yaw only', async () => {
    const baked = new Texture();
    jest.spyOn(ThreeProceduralSky.prototype, 'bake').mockReturnValue(baked as any);
    scene.setEnvironment({ background: { type: 'PROCEDURAL', mode: 'BAKED' } });
    world.frame = { position: Pnt3.O, yaw: 0.7 };
    const renderer = addRenderer();
    await world.addBackdrop();
    calls.length = 0;
    renderer.renderer.render();
    const [backdropPass, mainPass] = renders();
    expect(backdropPass.background).toBe(baked);
    expect(backdropPass.rotation.x).toBeCloseTo(0);
    expect(backdropPass.rotation.z).toBeCloseTo(0.7);
    expect(mainPass.background).toBeNull();
    expect(scene.nativeScene!.background).toBe(baked);
  });

  it('draws backdrops farthest first, following live scale changes', async () => {
    const renderer = addRenderer();
    const a = await world.addBackdrop({ scale: 1 / 16 });
    const b = await world.addBackdrop({ scale: 1 / 256 });
    const sceneOf = (x: typeof a) => (x.ownedScene as ThreeSceneComponent).nativeScene;
    renderer.renderer.render();
    expect(renders().map(c => c.scene)).toEqual([sceneOf(b), sceneOf(a), scene.nativeScene]);
    b.scale = 1;
    calls.length = 0;
    renderer.renderer.render();
    expect(renders().map(c => c.scene)).toEqual([sceneOf(a), sceneOf(b), scene.nativeScene]);
  });

  it("puts a backdrop child's mesh and light into the backdrop's native scene", async () => {
    const backdrop = await world.addBackdrop();
    const own = (backdrop.ownedScene as ThreeSceneComponent).nativeScene!;
    const box = scene.factory.createBox({ x: 1, y: 1, z: 1 });
    const lamp = scene.factory.createLight({ type: 'DIRECTIONAL' });
    const mesh = new Entity3d({ object3D: box });
    const light = new Light3dEntity(lamp);
    backdrop.addChildren(mesh, light);
    expect(box.nativeMesh.parent).toBe(own);
    expect(lamp.nativeMesh.parent).toBe(own);
    expect(scene.nativeScene!.children).not.toContain(box.nativeMesh);
    // taken off the backdrop, the mesh leaves the backdrop scene
    backdrop.removeChildren([mesh]);
    expect(box.nativeMesh.parent).toBeNull();
  });

  it("hooks a backdrop child's particle system into the backdrop scene", async () => {
    const backdrop = await world.addBackdrop();
    const own = backdrop.ownedScene as ThreeSceneComponent;
    const particles = world.addParticleSystem({ capacity: 4 });
    expect(scene.beforeRenderHooks.size).toBe(1);
    backdrop.addChildren(particles);
    expect(scene.beforeRenderHooks.size).toBe(0);
    expect(own.beforeRenderHooks.size).toBe(1);
    world.removeEntity(particles, true);
    expect(own.beforeRenderHooks.size).toBe(0);
  });

  it('joins and leaves every backdrop scene as one of its renderers', async () => {
    const early = await world.addBackdrop();
    const renderer = addRenderer();
    const late = await world.addBackdrop();
    const native = renderer.renderer as ThreeRendererComponent;
    expect((early.ownedScene as ThreeSceneComponent).renderers.has(native)).toBe(true);
    expect((late.ownedScene as ThreeSceneComponent).renderers.has(native)).toBe(true);
    const release = jest.spyOn(late.ownedScene as ThreeSceneComponent, 'releaseRenderer');
    world.removeEntity(late);
    expect((late.ownedScene as ThreeSceneComponent).renderers.has(native)).toBe(false);
    expect(release).toHaveBeenCalledWith(native.nativeRenderer);
    world.removeEntity(renderer);
    expect((early.ownedScene as ThreeSceneComponent).renderers.has(native)).toBe(false);
  });

  it('a frame switch leaves the backdrop camera where it was', async () => {
    const renderer = addRenderer();
    const backdrop = await world.addBackdrop();
    renderer.position = { x: 40, y: -8, z: 3 };
    renderer.rotation = Qtrn.fromEuler({ x: 1.2, y: 0, z: 0.4 });
    renderer.renderer.render();
    const before = backdrop.camera.position;
    world.switchFrame(new Frame3d({ x: 100, y: 50, z: 0 }, 1.1));
    renderer.renderer.render();
    const after = backdrop.camera.position;
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(after.z).toBeCloseTo(before.z);
  });

  describe('composer renderer', () => {
    const addComposer = () => {
      const component = scene.createComposerRenderer(
        scene.factory.createPerspectiveCamera(),
        document.createElement('canvas'),
      );
      component.addToWorld(world);
      calls.length = 0;
      return component as ThreeComposerRendererComponent;
    };

    it('inserts one RenderPass per backdrop in front of the world pass, farthest first', async () => {
      scene.setEnvironment({ background: 0x334455 });
      const composer = addComposer();
      const near = await world.addBackdrop({ scale: 1 / 16 });
      const far = await world.addBackdrop({ scale: 1 / 256 });
      composer.render();
      const passes = composer.nativeComposer.passes as any[];
      expect(passes.map(p => p.scene)).toEqual([
        (far.ownedScene as ThreeSceneComponent).nativeScene,
        (near.ownedScene as ThreeSceneComponent).nativeScene,
        scene.nativeScene,
      ]);
      expect(passes.map(p => [p.clear, p.clearDepth])).toEqual([
        [true, false],
        [false, true],
        [false, true],
      ]);
      const [farPass, , mainPass] = renders();
      expect((farPass.background as Color).getHex()).toBe(0x334455);
      expect(mainPass.background).toBeNull();
      expect((scene.nativeScene!.background as Color).getHex()).toBe(0x334455);

      world.removeEntity(far);
      composer.render();
      expect(passes.map(p => p.scene)).toEqual([(near.ownedScene as ThreeSceneComponent).nativeScene, scene.nativeScene]);
      world.removeEntity(near);
      composer.render();
      expect(passes.map(p => [p.scene, p.clear, p.clearDepth])).toEqual([[scene.nativeScene, true, false]]);
      composer.removeFromWorld(world, true);
    });
  });
});
