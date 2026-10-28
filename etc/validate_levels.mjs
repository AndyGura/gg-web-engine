#!/usr/bin/env node
// Validates every level document in the repo against the level JSON schema of its dimension
// (packages/core/schema/level-{3d,2d}.schema.json):
//
// - JSON levels: any .json file under examples/ or templates/ whose root object has an
//   `entities` array.
// - TypeScript levels: every top-level `const x: LevelJson = ...` in examples/** and
//   templates/*/src. The script cuts the declaration out of its module together with the
//   top-level declarations and imports it uses (so the module's own side effects, like creating a
//   world, never run), bundles that with esbuild against packages/core/src, runs it and reads the
//   object back.
//
// The dimension comes from the nearest package.json: @gg-web-engine/three -> 3D,
// @gg-web-engine/pixi -> 2D.
//
// Usage: node etc/validate_levels.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(join(repoRoot, 'package.json'));
const ts = require('typescript');
const esbuild = require('esbuild');
const Ajv2020 = require('ajv/dist/2020').default;

const ROOTS = ['examples', 'templates'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.angular']);
/** Shared binary/model assets of the examples, no levels in there. */
const SKIP_PATHS = new Set([join('examples', 'assets')]);

function* walkFiles(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(name) && !SKIP_PATHS.has(relative(repoRoot, path))) {
        yield* walkFiles(path);
      }
    } else {
      yield path;
    }
  }
}

/** `'3d'` or `'2d'`, from the visual adapter the file's own package depends on. */
function dimensionOf(file) {
  for (let dir = dirname(file); dir.startsWith(repoRoot); dir = dirname(dir)) {
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg)) {
      const json = JSON.parse(readFileSync(pkg, 'utf8'));
      const deps = { ...json.dependencies, ...json.devDependencies };
      if (deps['@gg-web-engine/three']) return '3d';
      if (deps['@gg-web-engine/pixi']) return '2d';
      return null;
    }
  }
  return null;
}

/** Top-level `const` declarations annotated `LevelJson`, as a module exporting just them. */
function sliceLevels(file) {
  // A program of this one file, for its checker: it tells a reference to a top-level name from an
  // object key, a property access or a local of the same name.
  const program = ts.createProgram([file], { noResolve: true, noLib: true, types: [], target: ts.ScriptTarget.Latest });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(file);
  const declarations = new Map(); // name -> statement
  const imports = new Map(); // local name -> { module, imported } (imported: name, 'default' or '*')
  const levels = [];
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (!clause || clause.isTypeOnly) continue;
      const module = statement.moduleSpecifier.text;
      if (clause.name) imports.set(clause.name.text, { module, imported: 'default' });
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) imports.set(bindings.name.text, { module, imported: '*' });
      if (bindings && ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) {
          if (!el.isTypeOnly) {
            imports.set(el.name.text, { module, imported: (el.propertyName ?? el.name).text });
          }
        }
      }
    } else if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        for (const name of bindingNames(decl.name)) declarations.set(name, statement);
        const isConst = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
        if (isConst && ts.isIdentifier(decl.name) && decl.type?.getText(source) === 'LevelJson' && decl.initializer) {
          levels.push(decl.name.text);
        }
      }
    } else if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) &&
      statement.name
    ) {
      declarations.set(statement.name.text, statement);
    }
  }
  if (!levels.length) return null;

  // Every top-level declaration and import the levels reach, ignoring type positions.
  const neededStatements = new Set();
  const neededImports = new Set();
  const visit = node => {
    if (ts.isTypeNode(node) && !ts.isExpressionWithTypeArguments(node)) return;
    const name = ts.isIdentifier(node) ? topLevelReference(node) : undefined;
    if (name) {
      if (imports.has(name)) neededImports.add(name);
      const statement = declarations.get(name);
      if (statement && !neededStatements.has(statement)) {
        neededStatements.add(statement);
        ts.forEachChild(statement, visit);
      }
    }
    ts.forEachChild(node, visit);
  };
  /** The top-level name `id` refers to, if it refers to one. */
  function topLevelReference(id) {
    const symbol = ts.isShorthandPropertyAssignment(id.parent)
      ? checker.getShorthandAssignmentValueSymbol(id.parent)
      : checker.getSymbolAtLocation(id);
    const declaration = symbol?.declarations?.find(d => isTopLevel(d));
    return declaration ? id.text : undefined;
  }
  function isTopLevel(declaration) {
    const isBinding =
      ts.isVariableDeclaration(declaration) ||
      ts.isBindingElement(declaration) ||
      ts.isFunctionDeclaration(declaration) ||
      ts.isClassDeclaration(declaration) ||
      ts.isEnumDeclaration(declaration) ||
      ts.isImportClause(declaration) ||
      ts.isImportSpecifier(declaration) ||
      ts.isNamespaceImport(declaration);
    if (!isBinding) return false; // an object key, a property, a parameter...
    for (let node = declaration.parent; node && node !== source; node = node.parent) {
      if (ts.isFunctionLike(node) || ts.isClassLike(node) || ts.isBlock(node)) return false;
    }
    return true;
  }
  for (const name of levels) {
    const statement = declarations.get(name);
    neededStatements.add(statement);
    ts.forEachChild(statement, visit);
  }

  const byModule = new Map();
  for (const name of neededImports) {
    const { module, imported } = imports.get(name);
    if (!byModule.has(module)) byModule.set(module, []);
    byModule.get(module).push({ name, imported });
  }
  const lines = [];
  for (const [module, names] of byModule) {
    for (const { name, imported } of names) {
      if (imported === 'default') lines.push(`import ${name} from ${JSON.stringify(module)};`);
      else if (imported === '*') lines.push(`import * as ${name} from ${JSON.stringify(module)};`);
      else lines.push(`import { ${imported} as ${name} } from ${JSON.stringify(module)};`);
    }
  }
  for (const statement of source.statements) {
    if (neededStatements.has(statement)) {
      lines.push(statement.getText(source).replace(/^export\s+/, ''));
    }
  }
  lines.push(`export const __levels = { ${levels.join(', ')} };`);
  return lines.join('\n');
}

function bindingNames(name) {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap(el => (ts.isOmittedExpression(el) ? [] : bindingNames(el.name)));
}

/** Runs a sliced module and returns its `__levels`. */
async function evaluateLevels(file, contents, outDir) {
  const result = await esbuild.build({
    stdin: { contents, resolveDir: dirname(file), sourcefile: relative(repoRoot, file), loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    alias: { '@gg-web-engine/core': join(repoRoot, 'packages/core/src/index.ts') },
    nodePaths: [join(repoRoot, 'node_modules')],
    // Vite templates prefix asset URLs with `import.meta.env.BASE_URL`.
    define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/' }) },
  });
  const out = join(outDir, `${relative(repoRoot, file).replace(/[\\/]/g, '_')}.mjs`);
  writeFileSync(out, result.outputFiles[0].text);
  return (await import(pathToFileURL(out).href)).__levels;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validators = {
  '3d': ajv.compile(JSON.parse(readFileSync(join(repoRoot, 'packages/core/schema/level-3d.schema.json'), 'utf8'))),
  '2d': ajv.compile(JSON.parse(readFileSync(join(repoRoot, 'packages/core/schema/level-2d.schema.json'), 'utf8'))),
};

/**
 * The most specific errors: ajv reports every branch of a failed union, so per top-level item
 * (`/entities/3`, `/blueprints/x`, or the root itself) keep only its deepest paths.
 */
function summarize(errors) {
  const depth = e => e.instancePath.split('/').length;
  const itemOf = e => e.instancePath.split('/').slice(0, 3).join('/');
  const deepest = new Map();
  for (const e of errors) deepest.set(itemOf(e), Math.max(deepest.get(itemOf(e)) ?? 0, depth(e)));
  return errors
    .filter(e => depth(e) === deepest.get(itemOf(e)) && e.keyword !== 'if')
    .map(
      e =>
        `    ${e.instancePath || '/'} ${e.message}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ''}`,
    )
    .filter((line, i, all) => all.indexOf(line) === i);
}

const documents = []; // { label, dimension, level }
const problems = [];
const outDir = mkdtempSync(join(tmpdir(), 'gg-validate-levels-'));
try {
  for (const root of ROOTS) {
    for (const file of walkFiles(join(repoRoot, root))) {
      const rel = relative(repoRoot, file);
      if (file.endsWith('.json') && !/(^|[\\/])(package(-lock)?|tsconfig[^\\/]*)\.json$/.test(file)) {
        let json;
        try {
          json = JSON.parse(readFileSync(file, 'utf8'));
        } catch {
          continue;
        }
        if (json && Array.isArray(json.entities)) {
          documents.push({ label: rel, dimension: dimensionOf(file), level: json });
        }
      } else if (
        file.endsWith('.ts') &&
        !file.endsWith('.d.ts') &&
        (root === 'examples' || rel.split(/[\\/]/)[2] === 'src')
      ) {
        const sliced = sliceLevels(file);
        if (!sliced) continue;
        try {
          const levels = await evaluateLevels(file, sliced, outDir);
          for (const [name, level] of Object.entries(levels)) {
            documents.push({ label: `${rel} (${name})`, dimension: dimensionOf(file), level });
          }
        } catch (e) {
          problems.push(`${rel}: could not evaluate its LevelJson constants: ${e.message}`);
        }
      }
    }
  }
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

for (const { label, dimension, level } of documents) {
  if (!dimension) {
    problems.push(
      `${label}: no @gg-web-engine/three or @gg-web-engine/pixi dependency found, cannot tell its dimension`,
    );
    continue;
  }
  const validate = validators[dimension];
  // Through JSON, as the loader would read it from a file.
  if (validate(JSON.parse(JSON.stringify(level)))) {
    console.log(`ok    ${label} (${dimension.toUpperCase()}, ${level.entities.length} entities)`);
  } else {
    problems.push(`${label} (${dimension.toUpperCase()}):\n${summarize(validate.errors).join('\n')}`);
  }
}

if (problems.length) {
  console.error(`\n${problems.length} level document(s) failed:\n`);
  console.error(problems.join('\n\n'));
  process.exit(1);
}
console.log(`\nAll ${documents.length} level documents match the level JSON schema.`);
