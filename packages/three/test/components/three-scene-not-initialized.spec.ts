import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import { ThreeDisplayObjectComponent, ThreeSceneComponent } from '../../src';

describe('ThreeSceneComponent before init()', () => {
  it('names the fix instead of silently dropping a display object added before init', () => {
    const scene = new ThreeSceneComponent();
    const component = new ThreeDisplayObjectComponent(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()));
    expect(() => component.addToWorld({ visualScene: scene } as any)).toThrow(
      /ThreeSceneComponent is not initialized yet.*adding display objects to the world.*await world\.init\(\)/,
    );
  });

  it('adds the display object once initialized', async () => {
    const scene = new ThreeSceneComponent();
    await scene.init();
    const component = new ThreeDisplayObjectComponent(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()));
    component.addToWorld({ visualScene: scene } as any);
    expect(scene.nativeScene!.children).toContain(component.nativeMesh);
  });
});
