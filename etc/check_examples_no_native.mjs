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
// Usage: node etc/check_examples_no_native.mjs [examples-dir]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2] ?? new URL('../examples', import.meta.url).pathname;
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

if (violations.length) {
  console.error(`Examples must use @gg-web-engine/* APIs only, found ${violations.length} violation(s):\n`);
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('examples: no direct rendering/physics library usage found');
