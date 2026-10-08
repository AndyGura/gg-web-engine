#!/usr/bin/env node
// Fails when an example under examples/ reaches past the engine into a third-party rendering or
// physics library: importing three / pixi.js / ammo.js / matter-js / @dimforge/* directly, or using
// an adapter's `native*` escape hatch (`nativeMesh`, `nativeSprite`, `nativeBody`, ...). Examples
// are the engine's tutorials, so everything they do should go through @gg-web-engine/* APIs; a gap
// found this way is a missing engine option, not something to work around in the example.
//
// A line that deliberately demonstrates interop with the native library can opt out with a
// trailing `// gg-allow-native` comment.
//
// It also checks the examples' setup: no example lists one of those libraries in its package.json
// (each adapter brings its own), no build config stubs Node built-ins for Ammo's glue (the ammo
// package does that itself), and every example in examples.json runs on every physics adapter of
// its dimension.
//
// Usage: node etc/check_examples_no_native.mjs [examples-dir]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.argv[2] ?? fileURLToPath(new URL('../examples', import.meta.url));
const SKIP_DIRS = new Set(['node_modules', 'dist', '.angular', 'assets']);
const SOURCE_FILE = /\.(ts|tsx|mts|js|mjs)$/;
const CONFIG_FILE = /^(webpack|karma|jest)\..*\.js$|^webpack\.config\.js$/;

const FORBIDDEN_MODULE = String.raw`(?:three|pixi\.js|ammo\.js|matter-js|@dimforge\/[\w.-]+)(?:\/[^'"]*)?`;
const rules = [
  {
    name: 'direct import of a rendering/physics library',
    pattern: new RegExp(
      String.raw`(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]${FORBIDDEN_MODULE}['"]`,
    ),
  },
  {
    // `nativeElement` is Angular's ElementRef, not an engine escape hatch
    name: 'native* escape hatch',
    pattern: /\.native(?!Element\b)[A-Z]\w*/,
  },
];

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) yield* sourceFiles(path);
    } else if (SOURCE_FILE.test(entry) && !CONFIG_FILE.test(entry) && !entry.endsWith('.d.ts')) {
      yield path;
    }
  }
}

const violations = [];
for (const file of sourceFiles(root)) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      if (line.includes('gg-allow-native')) return;
      for (const rule of rules) {
        if (rule.pattern.test(line)) {
          violations.push(`${relative(process.cwd(), file)}:${index + 1}: ${rule.name}\n    ${line.trim()}`);
        }
      }
    });
}

// --- setup: package.json dependencies, Node built-in stubs, backends per example
const LIBRARY_PACKAGE =
  /^(?:three|@types\/three|pixi\.js|ammo\.js|matter-js|@types\/matter-js|@dimforge\/.+|mini-signals)$/;
const PHYSICS_BY_DIMENSION = { '2d': ['matter', 'rapier2d'], '3d': ['ammo', 'rapier3d'] };
const NODE_STUB = /["']?(?:fs|os|path)["']?\s*:\s*false/;

function* exampleDirs(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (!SKIP_DIRS.has(entry) && statSync(path).isDirectory()) {
      if (readdirSync(path).includes('package.json')) yield path;
      else yield* exampleDirs(path);
    }
  }
}

for (const dir of exampleDirs(root)) {
  const pkgFile = join(dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
  for (const section of ['dependencies', 'devDependencies', 'overrides']) {
    for (const name of Object.keys(pkg[section] ?? {})) {
      if (LIBRARY_PACKAGE.test(name)) {
        violations.push(`${relative(process.cwd(), pkgFile)}: ${section} lists ${name}; the adapter package brings it`);
      }
    }
  }
  if (pkg.browser) {
    violations.push(
      `${relative(process.cwd(), pkgFile)}: a "browser" field stubs Node built-ins; the ammo package does that itself`,
    );
  }
  for (const entry of readdirSync(dir).filter(f => CONFIG_FILE.test(f))) {
    const file = join(dir, entry);
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (NODE_STUB.test(line)) {
          violations.push(
            `${relative(process.cwd(), file)}:${index + 1}: stubs a Node built-in; the ammo package does that itself\n    ${line.trim()}`,
          );
        }
      });
  }
}

const registryFile = join(root, 'examples.json');
for (const example of JSON.parse(readFileSync(registryFile, 'utf8')).examples) {
  const expected = PHYSICS_BY_DIMENSION[example.dir.split('/')[0]] ?? [];
  const missing = expected.filter(backend => !example.physics.includes(backend));
  if (missing.length) {
    violations.push(`${relative(process.cwd(), registryFile)}: ${example.dir} does not run on ${missing.join(', ')}`);
  }
}

if (violations.length) {
  console.error(`Examples must use @gg-web-engine/* APIs only, found ${violations.length} violation(s):\n`);
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('examples: engine APIs only, no library dependencies, every physics backend');
