import { readFileSync } from 'fs';
import { join } from 'path';
import Ajv2020, { ErrorObject, ValidateFunction } from 'ajv/dist/2020';
import { Gg2dLevelLoader, Gg3dLoader, LevelJson } from '../../src';

function loadSchema(dimension: '3d' | '2d'): ValidateFunction {
  const schema = JSON.parse(readFileSync(join(__dirname, `../../schema/level-${dimension}.schema.json`), 'utf8'));
  return new Ajv2020({ allErrors: true, strict: true }).compile(schema);
}

/** The schema's built-in class aliases (the `enum` that selects the per-class branch). */
function schemaAliases(dimension: '3d' | '2d'): string[] {
  const schema = JSON.parse(readFileSync(join(__dirname, `../../schema/level-${dimension}.schema.json`), 'utf8'));
  return [...schema.$defs.LevelEntityJson.if.properties.class.enum].sort();
}

/** The class aliases a freshly built loader registers. */
function registeredAliases(loader: object): string[] {
  return [...(loader as any).generators.keys()].sort();
}

function errorAt(errors: ErrorObject[] | null | undefined, instancePath: string): ErrorObject | undefined {
  return (errors ?? []).find(e => e.instancePath === instancePath);
}

describe('level JSON schema', () => {
  describe('3D', () => {
    const validate = loadSchema('3d');

    it('accepts a small level with built-in and app-registered classes', () => {
      const level: LevelJson = {
        entities: [
          {
            class: 'Primitive',
            shape: 'BOX',
            name: 'Floor',
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            config: { dimensions: { x: 7, y: 7, z: 1 }, material: { color: 0x888888 }, body: { bodyType: 'static' } },
          },
          { class: 'Trigger', position: { x: 0, y: 0, z: 2 }, config: { dimensions: { x: 1, y: 1, z: 1 } } },
          { class: 'Light', config: { type: 'DIRECTIONAL', intensity: 2, target: { x: 0, y: 0, z: 0 } } },
          { class: 'ShapeSpawner', position: 5, config: { anything: true } },
        ],
        blueprints: {
          despawn: { nodes: [{ id: 'n1', type: 'RemoveEntity' }], inputs: { in: { node: 'n1', pin: 'entity' } } },
        },
      };
      expect(validate(level)).toBe(true);
    });

    it('rejects a BOX without dimensions, naming its config', () => {
      const level = { entities: [{ class: 'Primitive', shape: 'BOX', config: { material: { color: 1 } } }] };
      expect(validate(level)).toBe(false);
      expect(errorAt(validate.errors, '/entities/0/config')).toMatchObject({
        keyword: 'required',
        params: { missingProperty: 'dimensions' },
      });
    });

    it('rejects an unknown shape, naming the shape', () => {
      const level = { entities: [{ class: 'Primitive', shape: 'TORUS', config: { radius: 1 } }] };
      expect(validate(level)).toBe(false);
      expect(errorAt(validate.errors, '/entities/0/shape')).toMatchObject({ keyword: 'enum' });
    });

    it('rejects a 2D rotation, naming the rotation', () => {
      const level = { entities: [{ class: 'Primitive', shape: 'SPHERE', rotation: 0.5, config: { radius: 1 } }] };
      expect(validate(level)).toBe(false);
      expect(errorAt(validate.errors, '/entities/0/rotation')).toMatchObject({ keyword: 'type' });
    });

    it('lists exactly the classes a 3D loader registers', () => {
      expect(schemaAliases('3d')).toEqual(registeredAliases(new Gg3dLoader({} as any)));
    });
  });

  describe('2D', () => {
    const validate = loadSchema('2d');

    it('accepts a small level with built-in and app-registered classes', () => {
      const level: LevelJson = {
        entities: [
          {
            class: 'Primitive',
            shape: 'BOX',
            position: { x: 0, y: 300 },
            rotation: 0,
            config: { dimensions: { x: 800, y: 20 }, body: { bodyType: 'static' } },
          },
          { class: 'Primitive', shape: 'CIRCLE', position: { x: 10, y: 10 }, config: { radius: 5 } },
          { class: 'Coin', position: { x: 1, y: 2 } },
        ],
      };
      expect(validate(level)).toBe(true);
    });

    it('rejects a BOX without dimensions, naming its config', () => {
      const level = { entities: [{ class: 'Primitive', shape: 'BOX', config: {} }] };
      expect(validate(level)).toBe(false);
      expect(errorAt(validate.errors, '/entities/0/config')).toMatchObject({
        keyword: 'required',
        params: { missingProperty: 'dimensions' },
      });
    });

    it('rejects an unknown shape, naming the shape', () => {
      const level = { entities: [{ class: 'Primitive', shape: 'SPHERE', config: { radius: 1 } }] };
      expect(validate(level)).toBe(false);
      expect(errorAt(validate.errors, '/entities/0/shape')).toMatchObject({ keyword: 'enum' });
    });

    it('rejects a quaternion rotation, naming the rotation', () => {
      const level = {
        entities: [
          { class: 'Primitive', shape: 'CIRCLE', rotation: { x: 0, y: 0, z: 0, w: 1 }, config: { radius: 1 } },
        ],
      };
      expect(validate(level)).toBe(false);
      expect(errorAt(validate.errors, '/entities/0/rotation')).toMatchObject({ keyword: 'type' });
    });

    it('lists exactly the classes a 2D loader registers', () => {
      expect(schemaAliases('2d')).toEqual(registeredAliases(new Gg2dLevelLoader({} as any)));
    });
  });
});
