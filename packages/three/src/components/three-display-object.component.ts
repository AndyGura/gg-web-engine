import {
  DisplayObject3dOpts,
  GgBox3d,
  IDisplayObject3dComponent,
  IEntity,
  IMaterialReadable3dComponent,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  RenderLayer,
  UniqueResources3d,
} from '@gg-web-engine/core';
import { Box3, BufferGeometry, Group, Light, Material, Matrix4, Mesh, Object3D, Scene, Texture } from 'three';
import { ThreeGgWorld, ThreeVisualTypeDocRepo } from '../types';

/** Every texture a material references (its maps), found by value rather than by a list of names. */
export function materialTextures(material: Material): Texture[] {
  return Object.values(material).filter((value): value is Texture => !!value && (value as Texture).isTexture === true);
}

/**
 * What a `ThreeDisplayObjectComponent` frees on `dispose()`, from nothing to everything; each level
 * includes the ones before it. See `ThreeDisplayObjectComponent.resourceOwnership`.
 */
export type ThreeResourceOwnership = 'none' | 'materials' | 'meshes' | 'all';

const OWNERSHIP_LEVEL: Record<ThreeResourceOwnership, number> = { none: 0, materials: 1, meshes: 2, all: 3 };

/** One copy per original, so resources used several times keep being shared within the copy. */
function copyOnce<T extends { clone(): T }>(copies: Map<T, T>, original: T): T {
  let copy = copies.get(original);
  if (!copy) {
    copy = original.clone();
    copies.set(original, copy);
  }
  return copy;
}

export class ThreeDisplayObjectComponent
  implements
    IDisplayObject3dComponent<ThreeVisualTypeDocRepo>,
    Partial<IMaterialReadable3dComponent<ThreeVisualTypeDocRepo>>
{
  entity: IEntity | null = null;

  /**
   * The options this mesh was actually built with, when constructed via `ThreeFactory.createPrimitive`
   * (or a shortcut built on it) - see `IMaterialReadable3dComponent`'s own doc. Left unset for a mesh
   * built any other way (e.g. a loaded `.glb`), which is the reason this is `Partial` rather than a
   * hard implementation of that interface - check with `isMaterialReadable3d` before relying on it.
   */
  public readonly materialOptions?: DisplayObject3dOpts<Texture>;

  /**
   * What `dispose()` frees:
   * - `'meshes'` (default): the geometry and materials of every mesh in `nativeMesh`. Textures are
   *   left alone - a primitive's `diffuse` texture belongs to whoever loaded it.
   * - `'all'`: the materials' textures as well. Set by `ThreeLoader` on a loaded model, whose
   *   textures came with the file and have no other owner.
   * - `'materials'`: the materials only, not the geometry or textures. A clone after
   *   `makeUnique('materials')`: the materials are its own copies, the rest is still its source's.
   * - `'none'`: nothing. A `clone()` shares geometry, materials and textures with its source, which
   *   stays the one to free them.
   *
   * `makeUnique` raises it to the level it copied up to.
   */
  public resourceOwnership: ThreeResourceOwnership = 'meshes';

  constructor(
    public nativeMesh: Object3D,
    materialOptions?: DisplayObject3dOpts<Texture>,
  ) {
    if (materialOptions) {
      this.materialOptions = materialOptions;
    }
  }

  public get position(): Point3 {
    return Pnt3.clone(this.nativeMesh.position);
  }

  public set position(value: Point3) {
    this.nativeMesh.position.set(value.x, value.y, value.z);
  }

  public get rotation(): Point4 {
    return Qtrn.clone(this.nativeMesh.quaternion);
  }

  public set rotation(value: Point4) {
    this.nativeMesh.quaternion.set(value.x, value.y, value.z, value.w);
  }

  public get scale(): Point3 {
    return Pnt3.clone(this.nativeMesh.scale);
  }

  public set scale(value: Point3) {
    this.nativeMesh.scale.set(value.x, value.y, value.z);
  }

  public get visible(): boolean {
    return this.nativeMesh.visible;
  }

  public set visible(value: boolean) {
    this.nativeMesh.visible = value;
  }

  /**
   * The native `Object3D.name`; `''` while nothing has named this object. Never the mesh's `uuid`:
   * `Entity3d` adopts a named display object's name as its own world-unique entity name, and a
   * generated id there would replace the readable `entityTypeName`-based default.
   */
  public get name(): string {
    return this.nativeMesh.name;
  }

  public set name(value: string) {
    this.nativeMesh.name = value;
  }

  public enableRenderLayer(layer: RenderLayer): void {
    this.nativeMesh.traverse(obj => obj.layers.enable(layer));
  }

  public disableRenderLayer(layer: RenderLayer): void {
    this.nativeMesh.traverse(obj => obj.layers.disable(layer));
  }

  public isRenderLayerEnabled(layer: RenderLayer): boolean {
    return this.nativeMesh.layers.isEnabled(layer);
  }

  public get castShadow(): boolean {
    return this.nativeMesh.castShadow;
  }

  public set castShadow(value: boolean) {
    this.nativeMesh.traverse(obj => {
      // a light embedded in the hierarchy (e.g. one loaded from a .glb) keeps its own setting: on a
      // light this flag turns shadow map rendering on or off
      if (!(obj as Light).isLight) {
        obj.castShadow = value;
      }
    });
  }

  public get receiveShadow(): boolean {
    return this.nativeMesh.receiveShadow;
  }

  public set receiveShadow(value: boolean) {
    this.nativeMesh.traverse(obj => (obj.receiveShadow = value));
  }

  public addChild(child: ThreeDisplayObjectComponent): void {
    // `Object3D.add` already detaches the child from any previous parent
    this.nativeMesh.add(child.nativeMesh);
  }

  public removeChild(child: ThreeDisplayObjectComponent): void {
    if (child.nativeMesh.parent === this.nativeMesh) {
      this.nativeMesh.remove(child.nativeMesh);
    }
  }

  public isEmpty(): boolean {
    if (this.nativeMesh instanceof Scene || this.nativeMesh instanceof Group) {
      return this.nativeMesh.children.length == 0;
    }
    return false;
  }

  popChild(name: string): ThreeDisplayObjectComponent | null {
    const childMesh = this.nativeMesh.children.find(c => c.name === name || c.userData.name === name);
    if (childMesh) {
      childMesh.removeFromParent();
      const child = new ThreeDisplayObjectComponent(childMesh);
      child.resourceOwnership = this.resourceOwnership;
      return child;
    }
    return null;
  }

  getBoundings(): GgBox3d {
    return new Box3().setFromObject(this.nativeMesh);
  }

  /**
   * `nativeMesh`'s subtree measured in `nativeMesh`'s own frame: each geometry's bounding box (an
   * `InstancedMesh`'s/`SkinnedMesh`'s own, as `Box3.expandByObject` uses) carried through the local
   * matrices from that node up to, not including, `nativeMesh`. Built from local matrices only, so
   * neither `nativeMesh`'s own transform nor whatever it is parented to plays any part.
   */
  getLocalBoundings(): GgBox3d {
    const box = new Box3();
    const part = new Box3();
    const visit = (node: Object3D, toRoot: Matrix4) => {
      const withBox = node as Object3D & { boundingBox?: Box3 | null; computeBoundingBox?: () => void };
      const geometry = (node as Mesh).geometry;
      if (withBox.boundingBox !== undefined && withBox.computeBoundingBox) {
        if (withBox.boundingBox === null) {
          withBox.computeBoundingBox();
        }
        part.copy(withBox.boundingBox!);
      } else if (geometry) {
        if (geometry.boundingBox === null) {
          geometry.computeBoundingBox();
        }
        part.copy(geometry.boundingBox!);
      } else {
        part.makeEmpty();
      }
      if (!part.isEmpty()) {
        box.union(part.applyMatrix4(toRoot));
      }
      for (const child of node.children) {
        if (!child.visible) {
          continue;
        }
        if (child.matrixAutoUpdate) {
          child.updateMatrix();
        }
        visit(child, new Matrix4().multiplyMatrices(toRoot, child.matrix));
      }
    };
    visit(this.nativeMesh, new Matrix4());
    return box;
  }

  clone(): ThreeDisplayObjectComponent {
    const copy = new ThreeDisplayObjectComponent(this.nativeMesh.clone());
    copy.resourceOwnership = 'none';
    return copy;
  }

  /**
   * Replaces whatever of `resources` this object still shares (see `resourceOwnership`) with
   * copies of its own, across every mesh in `nativeMesh` - see
   * `IDisplayObject3dComponent.makeUnique`. Materials are `Material.clone()`d, a material array
   * element by element; geometry is `BufferGeometry.clone()`d, which copies every attribute
   * (skinning `skinIndex`/`skinWeight` and morph attributes included), while a `SkinnedMesh`'s
   * skeleton and bind matrix stay on the mesh, so skinning and morph targets work as before; a
   * texture is `Texture.clone()`d, which keeps sharing the image (`Texture.source`) with the
   * original - and its GPU upload, for as long as the two are sampled with the same settings. Afterwards `resourceOwnership` is `resources` and `dispose()` frees the
   * copies.
   *
   * An animation track bound to a material property (e.g. `.material.opacity`) binds to the
   * material it finds when an action for its clip is first created: call this before playing such
   * an animation. Textures held in a `ShaderMaterial`'s `uniforms` are not tracked (three.js copies
   * them along with the material, and nothing frees those copies).
   */
  public makeUnique(resources: UniqueResources3d = 'materials'): void {
    const owned = OWNERSHIP_LEVEL[this.resourceOwnership];
    const wanted = OWNERSHIP_LEVEL[resources];
    if (wanted <= owned) {
      return;
    }
    const copyMaterials = owned < OWNERSHIP_LEVEL.materials;
    const copyGeometry = owned < OWNERSHIP_LEVEL.meshes && wanted >= OWNERSHIP_LEVEL.meshes;
    const copyTextures = wanted >= OWNERSHIP_LEVEL.all;
    const materials = new Map<Material, Material>();
    const geometries = new Map<BufferGeometry, BufferGeometry>();
    const textures = new Map<Texture, Texture>();
    // the copies made in this call, so a material used by several meshes has its textures replaced once
    const retextured = new Set<Material>();
    const unique = (material: Material): Material => {
      const result = copyMaterials ? copyOnce(materials, material) : material;
      if (copyTextures && !retextured.has(result)) {
        retextured.add(result);
        const slots = result as unknown as Record<string, unknown>;
        for (const [key, value] of Object.entries(slots)) {
          if (value && (value as Texture).isTexture === true) {
            slots[key] = copyOnce(textures, value as Texture);
          }
        }
      }
      return result;
    };
    // `traverse` visits `nativeMesh` itself first, then every descendant
    this.nativeMesh.traverse(obj => {
      if (!(obj instanceof Mesh)) {
        return;
      }
      if (copyGeometry) {
        obj.geometry = copyOnce(geometries, obj.geometry as BufferGeometry);
      }
      obj.material = obj.material instanceof Array ? obj.material.map(unique) : unique(obj.material);
    });
    this.resourceOwnership = resources;
  }

  addToWorld(world: ThreeGgWorld): void {
    world.visualScene.requireNativeScene('adding display objects to the world').add(this.nativeMesh);
  }

  removeFromWorld(world: ThreeGgWorld, dispose?: boolean): void {
    world.visualScene.nativeScene?.remove(this.nativeMesh);
    if (dispose) {
      this.dispose();
    }
  }

  dispose(): void {
    if (this.resourceOwnership === 'none') {
      return;
    }
    // `traverse` visits `nativeMesh` itself first, then every descendant
    this.nativeMesh.traverse(obj => {
      if (obj instanceof Mesh) {
        this.disposeMesh(obj);
      }
    });
  }

  private disposeMesh(mesh: Mesh) {
    if (OWNERSHIP_LEVEL[this.resourceOwnership] >= OWNERSHIP_LEVEL.meshes) {
      mesh.geometry.dispose();
    }
    const mats = mesh.material instanceof Array ? mesh.material : [mesh.material];
    for (const material of mats) {
      if (this.resourceOwnership === 'all') {
        for (const texture of materialTextures(material)) {
          texture.dispose();
        }
      }
      material.dispose();
    }
  }
}
