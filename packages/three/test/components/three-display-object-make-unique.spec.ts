import {
  Bone,
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  Skeleton,
  SkinnedMesh,
  Texture,
  Uint16BufferAttribute,
} from 'three';
import { ThreeDisplayObjectComponent } from '../../src/components/three-display-object.component';
import { ThreeAnimatedDisplayObjectComponent } from '../../src/components/three-animated-display-object.component';
import { ThreeParticleSystemComponent } from '../../src/components/three-particle-system.component';

/** Every resource disposed so far, recorded through three's own `dispose` events. */
function trackDisposals() {
  const disposed = new Set<unknown>();
  const watch = (...resources: (BufferGeometry | Material | Texture)[]) =>
    resources.forEach(r => r.addEventListener('dispose', () => disposed.add(r)));
  return { disposed, watch };
}

/**
 * A model as `ThreeLoader` returns it: two meshes sharing one textured material, and a third mesh
 * with a material array whose first element is that same material.
 */
function buildModel() {
  const texture = new Texture();
  const shared = new MeshStandardMaterial({ color: 0xff0000, map: texture });
  const other = new MeshBasicMaterial({ color: 0x00ff00 });
  const geometry = new BoxGeometry(1, 1, 1);
  const root = new Group();
  const a = new Mesh(geometry, shared);
  a.name = 'a';
  const b = new Mesh(new BoxGeometry(2, 2, 2), shared);
  b.name = 'b';
  const multi = new Mesh(geometry, [shared, other]);
  multi.name = 'multi';
  root.add(a, b, multi);
  const original = new ThreeDisplayObjectComponent(root);
  original.resourceOwnership = 'all';
  return { original, texture, shared, other, geometry };
}

const meshNamed = (component: ThreeDisplayObjectComponent, name: string) =>
  component.nativeMesh.getObjectByName(name) as Mesh;

describe('ThreeDisplayObjectComponent.makeUnique', () => {
  describe("'materials'", () => {
    it('gives a clone its own materials, keeping geometry and textures shared', () => {
      const { original, shared, other, geometry, texture } = buildModel();
      const copy = original.clone();
      copy.makeUnique('materials');

      const a = meshNamed(copy, 'a');
      const b = meshNamed(copy, 'b');
      const multi = meshNamed(copy, 'multi');
      expect(a.material).not.toBe(shared);
      expect((a.material as MeshStandardMaterial).map).toBe(texture);
      expect(a.geometry).toBe(geometry);
      // one copy per original material: the copy keeps its own sharing
      expect(b.material).toBe(a.material);
      const array = multi.material as Material[];
      expect(array).toHaveLength(2);
      expect(array[0]).toBe(a.material);
      expect(array[1]).not.toBe(other);
      expect(copy.resourceOwnership).toBe('materials');
    });

    it('leaves the originals untouched when the copy is changed', () => {
      const { original, shared } = buildModel();
      const copy = original.clone();
      copy.makeUnique();

      (meshNamed(copy, 'a').material as MeshStandardMaterial).color.setHex(0x0000ff);
      expect(shared.color.getHex()).toBe(0xff0000);
      expect(meshNamed(original, 'a').material).toBe(shared);
      expect(meshNamed(original, 'b').material).toBe(shared);
    });

    it('frees its own materials on dispose, never the shared geometry, textures or originals', () => {
      const { original, shared, other, geometry, texture } = buildModel();
      const copy = original.clone();
      copy.makeUnique('materials');
      const copies = [meshNamed(copy, 'a').material as Material, (meshNamed(copy, 'multi').material as Material[])[1]];
      const { disposed, watch } = trackDisposals();
      watch(shared, other, geometry, texture, meshNamed(original, 'b').geometry, ...copies);

      copy.dispose();
      expect([...disposed]).toEqual(expect.arrayContaining(copies));
      expect(disposed.size).toBe(2);
    });

    it('is not affected by disposing the original', () => {
      const { original } = buildModel();
      const copy = original.clone();
      copy.makeUnique('materials');
      const copies = [meshNamed(copy, 'a').material as Material, (meshNamed(copy, 'multi').material as Material[])[1]];
      const { disposed, watch } = trackDisposals();
      watch(...copies);

      original.dispose();
      expect(disposed.size).toBe(0);
    });
  });

  describe("'meshes'", () => {
    it('copies geometry once per original geometry, too', () => {
      const { original, geometry } = buildModel();
      const copy = original.clone();
      copy.makeUnique('meshes');

      const a = meshNamed(copy, 'a');
      expect(a.geometry).not.toBe(geometry);
      expect(meshNamed(copy, 'multi').geometry).toBe(a.geometry);
      expect(meshNamed(copy, 'b').geometry).not.toBe(meshNamed(original, 'b').geometry);
      expect(copy.resourceOwnership).toBe('meshes');
    });

    it('frees its geometry and materials, and neither side disposes the other', () => {
      const { original, texture } = buildModel();
      const copy = original.clone();
      copy.makeUnique('meshes');
      const own = [
        meshNamed(copy, 'a').geometry,
        meshNamed(copy, 'b').geometry,
        meshNamed(copy, 'a').material as Material,
        (meshNamed(copy, 'multi').material as Material[])[1],
      ];
      const { disposed, watch } = trackDisposals();
      watch(...own, texture);

      original.dispose();
      expect([...disposed]).toEqual([texture]);
      disposed.clear();
      copy.dispose();
      expect(new Set(disposed)).toEqual(new Set(own));
    });

    it('keeps skinning attributes, morph targets and the skeleton binding of a skinned mesh', () => {
      const geometry = new BoxGeometry(1, 1, 1);
      const count = geometry.attributes.position.count;
      geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Array(count * 4).fill(0), 4));
      geometry.setAttribute('skinWeight', new Float32BufferAttribute(new Array(count * 4).fill(0.25), 4));
      geometry.morphAttributes.position = [new Float32BufferAttribute(new Array(count * 3).fill(1), 3)];
      const bone = new Bone();
      bone.name = 'root-bone';
      const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial());
      mesh.name = 'skin';
      mesh.add(bone);
      mesh.bind(new Skeleton([bone]));
      mesh.updateMorphTargets();
      const root = new Group();
      root.add(mesh);
      const original = new ThreeAnimatedDisplayObjectComponent(root, []);
      original.resourceOwnership = 'all';

      const copy = original.clone();
      copy.makeUnique('meshes');
      const skinned = copy.nativeMesh.getObjectByName('skin') as SkinnedMesh;
      expect(skinned.geometry).not.toBe(geometry);
      expect(skinned.geometry.attributes.skinIndex.count).toBe(count);
      expect(skinned.geometry.attributes.skinWeight.getX(0)).toBe(0.25);
      expect(skinned.geometry.morphAttributes.position).toHaveLength(1);
      expect(skinned.morphTargetInfluences).toHaveLength(1);
      // still bound to the copy's own bones (SkeletonUtils.clone), with the same bind matrix
      expect(skinned.skeleton.bones[0]).toBe(copy.nativeMesh.getObjectByName('root-bone'));
      expect(skinned.skeleton.bones[0]).not.toBe(bone);
      expect(skinned.bindMatrix.equals(mesh.bindMatrix)).toBe(true);
      expect(skinned.material).not.toBe(mesh.material);
    });
  });

  describe("'all'", () => {
    it('copies textures as well, keeping the image shared', () => {
      const { original, texture } = buildModel();
      const copy = original.clone();
      copy.makeUnique('all');

      const map = (meshNamed(copy, 'a').material as MeshStandardMaterial).map!;
      expect(map).not.toBe(texture);
      expect(map.source).toBe(texture.source);
      map.wrapS = RepeatWrapping;
      expect(texture.wrapS).not.toBe(RepeatWrapping);
      expect(((meshNamed(copy, 'multi').material as Material[])[0] as MeshStandardMaterial).map).toBe(map);
    });

    it('frees the copied textures, never the original ones', () => {
      const { original, texture } = buildModel();
      const copy = original.clone();
      copy.makeUnique('all');
      const map = (meshNamed(copy, 'a').material as MeshStandardMaterial).map!;
      const { disposed, watch } = trackDisposals();
      watch(texture, map);

      copy.dispose();
      expect([...disposed]).toEqual([map]);
      disposed.clear();
      original.dispose();
      expect([...disposed]).toEqual([texture]);
    });

    it("copies only the texture of a primitive, which owns its geometry and materials ('meshes')", () => {
      const diffuse = new Texture();
      const material = new MeshStandardMaterial({ map: diffuse });
      const geometry = new BoxGeometry(1, 1, 1);
      const primitive = new ThreeDisplayObjectComponent(new Mesh(geometry, material));
      primitive.makeUnique('all');

      const mesh = primitive.nativeMesh as Mesh;
      expect(mesh.material).toBe(material);
      expect(mesh.geometry).toBe(geometry);
      expect(material.map).not.toBe(diffuse);
      const { disposed, watch } = trackDisposals();
      watch(diffuse);
      primitive.dispose();
      expect(disposed.size).toBe(0);
    });
  });

  describe('repeated calls', () => {
    it('does nothing when called again with the same or a lower level', () => {
      const { original } = buildModel();
      const copy = original.clone();
      copy.makeUnique('meshes');
      const material = meshNamed(copy, 'a').material;
      const geometry = meshNamed(copy, 'a').geometry;

      copy.makeUnique('meshes');
      copy.makeUnique('materials');
      copy.makeUnique();
      expect(meshNamed(copy, 'a').material).toBe(material);
      expect(meshNamed(copy, 'a').geometry).toBe(geometry);
      expect(copy.resourceOwnership).toBe('meshes');
    });

    it('raising the level copies only what is still shared', () => {
      const { original, geometry } = buildModel();
      const copy = original.clone();
      copy.makeUnique('materials');
      const material = meshNamed(copy, 'a').material;

      copy.makeUnique('meshes');
      expect(meshNamed(copy, 'a').material).toBe(material);
      expect(meshNamed(copy, 'a').geometry).not.toBe(geometry);
      expect(copy.resourceOwnership).toBe('meshes');
    });

    it('does nothing on an object that already owns everything (a loaded model)', () => {
      const { original, shared, geometry, texture } = buildModel();
      original.makeUnique('all');
      expect(meshNamed(original, 'a').material).toBe(shared);
      expect(meshNamed(original, 'a').geometry).toBe(geometry);
      expect(shared.map).toBe(texture);
    });
  });

  it('applies to children added with addChild', () => {
    const { original } = buildModel();
    const copy = original.clone();
    const wheelMaterial = new MeshBasicMaterial();
    const wheel = new ThreeDisplayObjectComponent(new Mesh(new BoxGeometry(1, 1, 1), wheelMaterial)).clone();
    wheel.name = 'wheel';
    copy.addChild(wheel);
    copy.makeUnique();
    expect(meshNamed(copy, 'wheel').material).not.toBe(wheelMaterial);
  });

  it('is a no-op on a particle system, whose resources are its own', () => {
    const system = new ThreeParticleSystemComponent({ capacity: 4 });
    const material = system.nativeMesh.material;
    system.makeUnique('all');
    expect(system.nativeMesh.material).toBe(material);
    expect(system.resourceOwnership).toBe('meshes');
  });
});
