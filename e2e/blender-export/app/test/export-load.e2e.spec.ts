/**
 * End-to-end: a Blender scene, built and exported by `../../fixture/build_scene.py`
 * (via the `GG Web Engine Exporter` add-on in `blender-addon/`), is loaded back through
 * a real `Gg3dWorld` - `@gg-web-engine/three` for rendering, `@gg-web-engine/rapier3d`
 * for physics - and the result is checked at all three levels the pipeline touches:
 * the three.js scene graph, the `.meta` sidecar, and the constructed physics bodies.
 *
 * This does NOT invoke Blender itself - the fixture must already exist on disk. Run
 * `npm run export-fixture` in `e2e/blender-export/` first (requires a `blender` binary
 * on PATH), or let `.github/workflows/blender_export_e2e.yml` do it. See
 * `../../fixture/build_scene.py`'s docstring for exactly what objects the fixture
 * contains and why (and what's deliberately left out).
 *
 * The last block reads the fixture's `scene_stripped` export (same scene, optional
 * vertex attributes and lights switched off) straight from the files instead of
 * loading it: it checks the exporter's options, not the loader.
 */
import * as fs from 'fs';
import * as path from 'path';
import { CachingStrategy, Entity3d, Gg3dWorld, GgMeta, TypedGg3dWorld } from '@gg-web-engine/core';
import { ThreeGgWorld, ThreeSceneComponent } from '@gg-web-engine/three';
import { Rapier3dGgWorld, Rapier3dRigidBodyComponent, Rapier3dWorldComponent } from '@gg-web-engine/rapier3d';
import { Light, Mesh, Object3D } from 'three';
import { StaticFixtureServer } from './static-fixture-server';

const FIXTURE_DIR = path.resolve(__dirname, '../../fixture/dist');
const FIXTURE_NAME = 'scene';
const STRIPPED_FIXTURE_NAME = 'scene_stripped';

const server = new StaticFixtureServer();
let world: TypedGg3dWorld<ThreeGgWorld, Rapier3dGgWorld>;
let entities: Entity3d[];
let meta: GgMeta;

beforeAll(async () => {
  for (const p of [FIXTURE_NAME, STRIPPED_FIXTURE_NAME].flatMap(name =>
    ['.glb', '.meta'].map(ext => path.join(FIXTURE_DIR, name + ext)),
  )) {
    if (!fs.existsSync(p)) {
      throw new Error(
        `Fixture not found: ${p}\nRun \`npm run export-fixture\` in e2e/blender-export/ first ` +
          '(requires a `blender` binary on PATH) - see e2e/blender-export/README.md.',
      );
    }
  }
  await server.start(FIXTURE_DIR);

  world = new Gg3dWorld({
    visualScene: new ThreeSceneComponent(),
    physicsWorld: new Rapier3dWorldComponent(),
  });
  await world.init();

  const loaded = await world.loader.loadGgGlb(`${server.baseUrl}/${FIXTURE_NAME}`, {
    loadProps: false,
    cachingStrategy: CachingStrategy.Nothing,
  });
  entities = loaded.entities;
  meta = loaded.meta;
  entities.forEach(e => world.addEntity(e));
}, 60000);

afterAll(async () => {
  world?.dispose();
  await server.stop();
});

function findInThreeScene(name: string): Object3D | undefined {
  let found: Object3D | undefined;
  world.visualScene!.nativeScene!.traverse(obj => {
    if (obj.name === name) found = obj;
  });
  return found;
}

describe('three.js scene', () => {
  it('contains the exported mesh', () => {
    const cube = findInThreeScene('ExportedCube');
    expect(cube).toBeInstanceOf(Mesh);
  });

  it('contains the exported light, with a positive post-conversion intensity', () => {
    const light = findInThreeScene('ExportedLight');
    expect(light).toBeDefined();
    expect((light as Light).isLight).toBe(true);
    expect((light as Light).intensity).toBeGreaterThan(0);
  });

  it('does not render the empty (dummy) as a scene object', () => {
    expect(findInThreeScene('SpawnPoint')).toBeUndefined();
  });
});

describe('.meta sidecar', () => {
  it('declares a formatVersion the loader understands', () => {
    expect(meta.formatVersion).toBe(2);
  });

  it('captures the empty as a dummy, with its custom property and position', () => {
    const dummy = meta.dummies.find(d => d.name === 'SpawnPoint');
    expect(dummy).toBeDefined();
    expect(dummy!.tag).toBe('spawn');
    expect(dummy!.position.x).toBeCloseTo(3);
    expect(dummy!.position.y).toBeCloseTo(0);
    expect(dummy!.position.z).toBeCloseTo(0);
  });

  it('captures the curve as a non-cyclic 3-point spline, with its custom property', () => {
    const curve = meta.curves.find(c => c.name === 'PatrolPath');
    expect(curve).toBeDefined();
    expect(curve!.cyclic).toBe(false);
    expect(curve!.points).toHaveLength(3);
    expect(curve!.speed).toBeCloseTo(2.5);
  });

  it('captures the dynamic box rigid body with its physics parameters', () => {
    const box = meta.rigidBodies.find(b => b.name === 'PhysBox');
    expect(box).toBeDefined();
    expect(box!.shape.shape).toBe('BOX');
    if (box!.shape.shape === 'BOX') {
      expect(box!.shape.dimensions.x).toBeCloseTo(1);
    }
    expect(box!.body.bodyType).toBe('dynamic');
    expect(box!.body.mass).toBeCloseTo(2);
    expect(box!.body.friction).toBeCloseTo(0.5);
    expect(box!.body.restitution).toBeCloseTo(0.3);
  });

  it('captures the static sphere rigid body', () => {
    const ball = meta.rigidBodies.find(b => b.name === 'PhysBall');
    expect(ball).toBeDefined();
    expect(ball!.shape.shape).toBe('SPHERE');
    if (ball!.shape.shape === 'SPHERE') {
      expect(ball!.shape.radius).toBeCloseTo(0.5);
    }
    expect(ball!.body.bodyType).toBe('static');
  });

  it('captures the compound rigid body with its two nested box children', () => {
    const compound = meta.rigidBodies.find(b => b.name === 'PhysCompound');
    expect(compound).toBeDefined();
    expect(compound!.shape.shape).toBe('COMPOUND');
    if (compound!.shape.shape === 'COMPOUND') {
      expect(compound!.shape.children).toHaveLength(2);
      expect(compound!.shape.children.every(c => c.shape.shape === 'BOX')).toBe(true);
    }
  });
});

describe('rapier3d physics world', () => {
  it('constructs one real rigid body per top-level meta rigid body (compound children are nested, not separate)', () => {
    expect(world.physicsWorld!.children).toHaveLength(3);
  });

  it('constructs bodies with the right shape kinds', () => {
    const shapes = world
      .physicsWorld!.children.filter((b): b is Rapier3dRigidBodyComponent => b instanceof Rapier3dRigidBodyComponent)
      .map(b => b.shape.shape)
      .sort();
    expect(shapes).toEqual(['BOX', 'COMPOUND', 'SPHERE']);
  });
});

/** The glTF JSON chunk of a `.glb`: 12-byte header, then the chunk's length and type, then the JSON. */
function readGlbJson(name: string): any {
  const bytes = fs.readFileSync(path.join(FIXTURE_DIR, name + '.glb'));
  const length = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + length).toString('utf8'));
}

function meshPrimitiveAttributes(gltf: any, meshName: string): string[] {
  const node = gltf.nodes.find((n: any) => n.name === meshName);
  return gltf.meshes[node.mesh].primitives.flatMap((p: any) => Object.keys(p.attributes));
}

describe('export options', () => {
  it('writes normals, tangents, UVs and lights by default', () => {
    const gltf = readGlbJson(FIXTURE_NAME);
    expect(meshPrimitiveAttributes(gltf, 'ExportedCube')).toEqual(
      expect.arrayContaining(['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0']),
    );
    expect(gltf.extensionsUsed).toContain('KHR_lights_punctual');
  });

  it('leaves out normals, tangents, UVs, vertex colors and lights when switched off', () => {
    const gltf = readGlbJson(STRIPPED_FIXTURE_NAME);
    expect(meshPrimitiveAttributes(gltf, 'ExportedCube')).toEqual(['POSITION']);
    expect(gltf.extensionsUsed ?? []).not.toContain('KHR_lights_punctual');
  });

  it('writes the same .meta whatever the options say', () => {
    const read = (name: string) => fs.readFileSync(path.join(FIXTURE_DIR, name + '.meta'), 'utf8');
    expect(read(STRIPPED_FIXTURE_NAME)).toEqual(read(FIXTURE_NAME));
  });
});
