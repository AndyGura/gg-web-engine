import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { ThreeDisplayObjectComponent } from '../../src/components/three-display-object.component';

/** Builds a GLTF-shaped hierarchy: a root Group with two child Meshes nested a level apart, the
 * way a loaded character model typically comes back from `GLTFLoader` (a root `Group`/`Scene`
 * wrapping several skinned/static sub-meshes rather than a single flat `Mesh`). */
function buildCharacterModel(): Group {
  const root = new Group();
  root.name = 'character';

  const body = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  body.name = 'body';
  root.add(body);

  const armsGroup = new Group();
  armsGroup.name = 'arms';
  const leftArm = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  leftArm.name = 'leftArm';
  armsGroup.add(leftArm);
  root.add(armsGroup);

  return root;
}

describe('ThreeDisplayObjectComponent', () => {
  describe('render layers on a single mesh', () => {
    it('enables/disables/queries the render layer on the underlying Object3D', () => {
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      const component = new ThreeDisplayObjectComponent(mesh);

      expect(component.isRenderLayerEnabled(5)).toBe(false);

      component.enableRenderLayer(5);
      expect(component.isRenderLayerEnabled(5)).toBe(true);
      expect(mesh.layers.isEnabled(5)).toBe(true);

      component.disableRenderLayer(5);
      expect(component.isRenderLayerEnabled(5)).toBe(false);
      expect(mesh.layers.isEnabled(5)).toBe(false);
    });
  });

  describe('render layers on a multi-mesh (GLTF-shaped) hierarchy', () => {
    it('enableRenderLayer/disableRenderLayer propagate to every descendant mesh, not just the root', () => {
      const root = buildCharacterModel();
      const body = root.getObjectByName('body')!;
      const leftArm = root.getObjectByName('leftArm')!;
      const component = new ThreeDisplayObjectComponent(root);

      component.enableRenderLayer(5);

      expect(root.layers.isEnabled(5)).toBe(true);
      expect(body.layers.isEnabled(5)).toBe(true);
      expect(leftArm.layers.isEnabled(5)).toBe(true);

      component.disableRenderLayer(5);

      expect(root.layers.isEnabled(5)).toBe(false);
      expect(body.layers.isEnabled(5)).toBe(false);
      expect(leftArm.layers.isEnabled(5)).toBe(false);
    });

    it('leaves layer 0 (the default layer) untouched on descendants when toggling a different layer', () => {
      const root = buildCharacterModel();
      const body = root.getObjectByName('body')!;
      const component = new ThreeDisplayObjectComponent(root);

      component.enableRenderLayer(5);

      // every Object3D starts on layer 0 by default - enabling an additional layer must not
      // knock descendants off it
      expect(body.layers.isEnabled(0)).toBe(true);
    });
  });
});
