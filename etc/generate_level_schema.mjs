#!/usr/bin/env node
// Generates the level JSON schemas shipped in @gg-web-engine/core (packages/core/schema/), one per
// dimension, from the level loader's TypeScript settings types. The schemas are committed: change
// a settings type (or packages/core/etc/level-schema/*.ts, which composes them), rerun this script
// and commit the result.
//
// Steps: ts-json-schema-generator turns `Level3DJson`/`Level2DJson` (packages/core/etc/level-schema)
// into a draft-07 schema; this script then rewrites it as draft 2020-12 (`$defs`), turns each union
// tagged by `class`/`shape`/`type` into `if`/`then` branches (so a validator reports only the
// selected branch's errors), lifts defaults stated in the JSDoc ("Default `0.5`.") into `default`,
// lets an entity whose `class` is not a built-in alias through as a plain `EntityJson` (apps
// register their own classes), and allows a top-level `$schema` key for editors.
//
// Usage:
//   node etc/generate_level_schema.mjs            write packages/core/schema/level-{3d,2d}.schema.json
//   node etc/generate_level_schema.mjs --check    exit 1 if the committed files differ from a fresh generation
//   node etc/generate_level_schema.mjs --out DIR  write the files into DIR instead
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const CORE = join(repoRoot, 'packages/core');
const TARGET_DIR = join(CORE, 'schema');
const require = createRequire(join(CORE, 'package.json'));
const ts = require('typescript');
const tsj = require('ts-json-schema-generator');
const Ajv2020 = require('ajv/dist/2020').default;

const SCHEMAS = [
  {
    file: 'level-3d.schema.json',
    source: 'etc/level-schema/level-3d.ts',
    type: 'Level3DJson',
    builtIns: 'BuiltIn3DEntityJson',
    title: 'gg-web-engine 3D level',
  },
  {
    file: 'level-2d.schema.json',
    source: 'etc/level-schema/level-2d.ts',
    type: 'Level2DJson',
    builtIns: 'BuiltIn2DEntityJson',
    title: 'gg-web-engine 2D level',
  },
];

// Live engine objects the generator cannot walk (it fails with "Reference type ID not set yet" on
// their deep generic type graph). They only appear in fields the level types leave out (e.g.
// `WheelDisplayOptions.displayObject`, dropped by `GgCarSharedWheelSettings`), so reading them as
// `any` changes nothing in the output.
const OPAQUE_TYPES = ['IDisplayObject3dComponent', 'IDisplayObject2dComponent'];

class OpaqueTypeParser {
  supportsNode(node) {
    return ts.isTypeReferenceNode(node) && OPAQUE_TYPES.includes(node.typeName.getText());
  }
  createType() {
    return new tsj.AnyType();
  }
}

/** Runs ts-json-schema-generator over one composition file. Returns its draft-07 output. */
function generateRaw({ source, type }) {
  const config = {
    path: join(CORE, source),
    tsconfig: join(CORE, 'etc/level-schema/tsconfig.json'),
    type,
    jsDoc: 'extended',
    expose: 'export',
    topRef: true,
    additionalProperties: false,
    // Type-checks the composition files first, which is what runs their `Same<>` assertions.
    skipTypeCheck: false,
  };
  const program = tsj.createProgram(config);
  const parser = tsj.createParser(program, config, p => p.addNodeParser(new OpaqueTypeParser()));
  const generator = new tsj.SchemaGenerator(program, parser, tsj.createFormatter(config), config);
  const level = generator.createSchema(type);
  const entity = generator.createSchema('EntityJson');
  return { level, entity };
}

/** Recursively applies `fn` to every schema object (depth first, children before parent). */
function walk(node, fn) {
  if (Array.isArray(node)) {
    return node.map(n => walk(n, fn));
  }
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = walk(v, fn);
    }
    return fn(out);
  }
  return node;
}

/** `DisplayObject3dOpts<any>` -> `DisplayObject3dOpts`, keeping names unique. */
function cleanDefName(name, taken) {
  const plain = decodeURIComponent(name).replace(/<.*>$/, '');
  return taken.has(plain) ? name : plain;
}

/** `{@link Foo}` -> `` `Foo` ``, and the whitespace the generator leaves around it. */
function cleanDescription(text) {
  return text
    .replace(/\s*\{@link\s+([^}\s]+)\s*\}\s*/g, ' `$1` ')
    .replace(/ {2,}/g, ' ')
    .replace(/ ([.,)])/g, '$1');
}

/**
 * The default a description states, as JSON, if it states one as a literal: "Default `0.5`.",
 * "Defaults to `true`", "(default `5`)", "Default 4.", "Default `0xffffff`", "Default `'hold'`",
 * "Default `{ x: 0.006, y: 0.002 }`". Anything else ("Default ~0.01", "Defaults to the audio
 * scene's ...", "Default `Math.PI / 3`") is left as prose.
 */
function statedDefault(description) {
  const match = description.match(/\bdefaults?(?: to)?:? (`[^`]+`|-?\d+(?:\.\d+)?(?![\d.]*\w))/i);
  if (!match) {
    return undefined;
  }
  let literal = match[1].replace(/^`|`$/g, '').trim();
  if (/^-?0x[0-9a-f]+$/i.test(literal)) {
    return Number(literal);
  }
  if (/^'[^']*'$/.test(literal)) {
    literal = JSON.stringify(literal.slice(1, -1));
  }
  // Object literals with bare keys, e.g. `{x:0,y:0,z:1}`.
  literal = literal.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
  try {
    return JSON.parse(literal);
  } catch {
    return undefined;
  }
}

const DISCRIMINATORS = ['class', 'shape', 'type'];

/**
 * Rewrites, in place, an `anyOf` whose branches each fix one tag property (`class`, `shape` or
 * `type`) to a different constant into one `if`/`then` per branch, plus an `enum` of the tag
 * values. It accepts the same documents, but a validator then reports only the errors of the
 * branch the tag selects ("`/entities/0/config` must have required property `dimensions`"),
 * instead of every branch's. A branch where the tag is optional (a `"Trigger"`'s default `"BOX"`)
 * is selected when the tag is absent too.
 */
function discriminate(node, $defs) {
  if (!Array.isArray(node.anyOf) || node.anyOf.length < 2) {
    return node;
  }
  // A branch's tag constant and whether it requires the tag; a branch that is itself a union
  // counts when all its members agree (every `"Primitive"` shape has `class: "Primitive"`).
  const tagOf = (branch, t) => {
    const b = branch.$ref ? $defs[decodeURIComponent(branch.$ref.slice('#/$defs/'.length))] : branch;
    if (Array.isArray(b?.anyOf)) {
      const members = b.anyOf.map(m => tagOf(m, t));
      const value = members[0]?.value;
      return members.every(m => m && m.value === value)
        ? { value, required: members.every(m => m.required), description: members[0].description }
        : undefined;
    }
    const prop = b?.properties?.[t];
    return prop && 'const' in prop
      ? { value: prop.const, required: (b.required ?? []).includes(t), description: prop.description }
      : undefined;
  };
  const tag = DISCRIMINATORS.find(
    t => node.anyOf.every(b => tagOf(b, t)) && new Set(node.anyOf.map(b => tagOf(b, t).value)).size > 1,
  );
  if (!tag) {
    return node;
  }
  // Branches sharing a tag value (a cylinder's two radius forms) stay one `anyOf` under one `if`.
  const groups = new Map();
  node.anyOf.forEach(branch => {
    const { value, required, description } = tagOf(branch, tag);
    const group = groups.get(value) ?? { branches: [], required: [], descriptions: new Set() };
    group.branches.push(branch);
    group.required.push(required);
    group.descriptions.add(description);
    groups.set(value, group);
  });
  if ([...groups.values()].some(g => new Set(g.required).size > 1)) {
    return node;
  }
  const optionalIn = [...groups.values()].filter(g => !g.required[0]).length;
  if (optionalIn > 1) {
    return node;
  }
  const descriptions = new Set([...groups.values()].flatMap(g => [...g.descriptions]));
  delete node.anyOf;
  node.type = 'object';
  node.properties = {
    [tag]: {
      enum: [...groups.keys()],
      ...(descriptions.size === 1 && [...descriptions][0] ? { description: [...descriptions][0] } : {}),
    },
  };
  if (optionalIn === 0) {
    node.required = [tag];
  }
  node.allOf = [...groups].map(([value, group]) => ({
    if: { properties: { [tag]: { const: value } }, ...(group.required[0] ? { required: [tag] } : {}) },
    then: group.branches.length === 1 ? group.branches[0] : { anyOf: group.branches },
  }));
  return node;
}

/** Draft-07 output of the generator -> the draft 2020-12 schema we ship. */
function toShippedSchema({ level, entity }, { builtIns, title }) {
  const defs = { ...level.definitions, ...entity.definitions };
  const names = new Map();
  for (const name of Object.keys(defs)) {
    const others = new Set(
      Object.keys(defs)
        .filter(n => n !== name)
        .map(n => decodeURIComponent(n)),
    );
    names.set(name, cleanDefName(name, others));
  }
  const rewrite = node =>
    walk(node, n => {
      if (typeof n.$ref === 'string' && n.$ref.startsWith('#/definitions/')) {
        const name = n.$ref.slice('#/definitions/'.length);
        n.$ref = `#/$defs/${encodeURIComponent(names.get(decodeURIComponent(name)))}`;
      }
      if (typeof n.description === 'string') {
        n.description = cleanDescription(n.description);
      }
      // A tuple in draft-07 array form becomes `prefixItems`.
      if (Array.isArray(n.items)) {
        n.prefixItems = n.items;
        n.items = n.additionalItems === undefined ? false : n.additionalItems;
        delete n.additionalItems;
      }
      return n;
    });
  const $defs = {};
  for (const [name, schema] of Object.entries(defs)) {
    $defs[names.get(name)] = rewrite(schema);
  }

  // Built-in class aliases, read off the `class` constants of the generated union.
  const aliases = new Set();
  const collectAliases = node => {
    if (node.$ref) {
      collectAliases($defs[decodeURIComponent(node.$ref.slice('#/$defs/'.length))]);
    } else if (node.anyOf) {
      node.anyOf.forEach(collectAliases);
    } else if (node.properties?.class?.const) {
      aliases.add(node.properties.class.const);
    }
  };
  collectAliases($defs[builtIns]);
  // Branches are resolved against the untouched definitions, since a branch can itself be a
  // union that gets rewritten (a `"Primitive"` is one `class` branch and a union on `shape`).
  const original = structuredClone($defs);
  for (const [name, def] of Object.entries($defs)) {
    $defs[name] = walk(def, n => discriminate(n, original));
  }
  const builtInRef = { $ref: `#/$defs/${builtIns}` };
  $defs.LevelEntityJson = {
    description:
      "One entity of the level. A built-in `class` must match that class's own schema; any other `class` is an app-registered one (see `LevelLoader.registerClass`), checked only against `EntityJson`, with `config` left open.",
    type: 'object',
    required: ['class'],
    if: { properties: { class: { enum: [...aliases].sort() } } },
    then: builtInRef,
    else: { $ref: '#/$defs/EntityJson' },
  };
  // The level type itself becomes the schema root.
  const rootName = names.get(decodeURIComponent(level.$ref.slice('#/definitions/'.length)));
  const root = $defs[rootName];
  delete $defs[rootName];
  root.properties.entities.items = { $ref: '#/$defs/LevelEntityJson' };
  // Lets a level file name its schema for editors; `loadLevel` ignores the key.
  root.properties = {
    $schema: { type: 'string', description: 'The JSON Schema this level is written against. Ignored by `loadLevel`.' },
    ...root.properties,
  };

  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title,
    ...root,
    $comment:
      'Generated from the level loader types by etc/generate_level_schema.mjs in the gg-web-engine repository. Do not edit by hand.',
    $defs,
  };
  addStatedDefaults(schema);
  return schema;
}

/** Adds `default` where a property's description states one that is valid for that property. */
function addStatedDefaults(schema) {
  const ajv = new Ajv2020({ strict: false, allErrors: false });
  ajv.addSchema(schema, 'level');
  const visit = (node, pointer) => {
    if (Array.isArray(node)) {
      node.forEach((n, i) => visit(n, `${pointer}/${i}`));
      return;
    }
    if (!node || typeof node !== 'object') {
      return;
    }
    if (node.properties) {
      for (const [key, prop] of Object.entries(node.properties)) {
        if (typeof prop.description !== 'string' || 'default' in prop) {
          continue;
        }
        const value = statedDefault(prop.description);
        const propPointer = `${pointer}/properties/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`;
        if (value !== undefined && ajv.validate({ $ref: `level#${encodeURI(propPointer)}` }, value)) {
          prop.default = value;
        }
      }
    }
    for (const [key, value] of Object.entries(node)) {
      visit(value, `${pointer}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`);
    }
  };
  visit(schema, '');
}

function render(spec) {
  return JSON.stringify(toShippedSchema(generateRaw(spec), spec), null, 2) + '\n';
}

const args = process.argv.slice(2);
if (args[0] === '--check') {
  const out = mkdtempSync(join(tmpdir(), 'gg-level-schema-'));
  let stale = false;
  for (const spec of SCHEMAS) {
    const fresh = render(spec);
    writeFileSync(join(out, spec.file), fresh);
    const committed = join(TARGET_DIR, spec.file);
    if (!existsSync(committed) || readFileSync(committed, 'utf8') !== fresh) {
      console.error(`packages/core/schema/${spec.file} is out of date (fresh copy in ${out}).`);
      stale = true;
    }
  }
  if (stale) {
    console.error('Run `npm run level-schema` and commit the result.');
    process.exit(1);
  }
  console.log('Level JSON schemas match the level loader types.');
} else {
  const outIndex = args.indexOf('--out');
  const dir = outIndex >= 0 ? args[outIndex + 1] : TARGET_DIR;
  mkdirSync(dir, { recursive: true });
  for (const spec of SCHEMAS) {
    writeFileSync(join(dir, spec.file), render(spec));
    console.log(`Wrote ${join(dir, spec.file)}`);
  }
}
