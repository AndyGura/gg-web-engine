#!/usr/bin/env node
// Measures what the engine adds to an app's download: every package's own code, the library it
// wraps, and each starter template as a whole app. Everything is bundled with esbuild (minified,
// ESM, browser) from the built packages/*/dist, then gzipped.
//
//   node etc/bundle_sizes.mjs           print the table
//   node etc/bundle_sizes.mjs --write   also replace the table in README.md
//
// Run `npm run build` first. The release workflow runs it with --write, so the README table
// matches each published version; PR CI prints it to the job summary.
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const README = join(root, 'README.md');
const START = '<!-- bundle-sizes:start -->';
const END = '<!-- bundle-sizes:end -->';

// in README order; `lib` is the third-party library the package wraps, measured on its own;
// `libNote` explains a size that would otherwise surprise
const PACKAGES = [
  { name: 'core', lib: null },
  { name: 'three', lib: 'three' },
  { name: 'pixi', lib: 'pixi.js' },
  { name: 'rapier3d', lib: '@dimforge/rapier3d-compat', libNote: 'WebAssembly inlined as base64' },
  { name: 'ammo', lib: null, libNote: 'Bullet, compiled to WebAssembly, ships inside the package' },
  { name: 'rapier2d', lib: '@dimforge/rapier2d-compat', libNote: 'WebAssembly inlined as base64' },
  { name: 'matter', lib: 'matter-js' },
  { name: 'audio', lib: null },
  { name: 'multiplayer', lib: null },
  { name: 'mobile-controls', lib: null },
];

const TEMPLATES = ['3d-character', '2d-platformer', 'multiplayer-cars'];

const pkgJson = name => JSON.parse(readFileSync(join(root, 'packages', name, 'package.json'), 'utf8'));

// every @gg-web-engine/* import resolves to the local build, not to whatever npm has
const localPackages = Object.fromEntries(
  PACKAGES.map(p => [`@gg-web-engine/${p.name}`, join(root, 'packages', p.name, 'dist', 'index.js')]),
);

async function bundle(options) {
  const result = await build({
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
    logLevel: 'silent',
    nodePaths: [join(root, 'node_modules')],
    alias: localPackages,
    // ammo's glue references Node built-ins behind runtime checks; its package.json stubs them
    // through the `browser` field, which esbuild honours with platform: 'browser'
    ...options,
  });
  const code = Buffer.concat(result.outputFiles.map(f => Buffer.from(f.contents)));
  return { min: code.length, gz: gzipSync(code, { level: 9 }).length };
}

// the package's own code: every export kept, its dependencies and peers left out
async function measurePackage({ name }) {
  const pkg = pkgJson(name);
  const external = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})].flatMap(d => [
    d,
    `${d}/*`,
  ]);
  return bundle({
    stdin: { contents: `export * from '@gg-web-engine/${name}';`, resolveDir: root },
    external: external.filter(d => !d.startsWith(`@gg-web-engine/${name}`)),
  });
}

// resolved from the package that wraps it, which may hold its own copy
async function measureLib(lib, from = root) {
  return bundle({ stdin: { contents: `export * from '${lib}';`, resolveDir: from } });
}

// a whole app, tree-shaken: what a player actually downloads
async function measureTemplate(template) {
  const dir = join(root, 'templates', template);
  return bundle({
    entryPoints: [join(dir, 'src', 'main.ts')],
    tsconfig: join(dir, 'tsconfig.json'),
    loader: { '.png': 'empty', '.jpg': 'empty', '.svg': 'empty', '.css': 'empty' },
  });
}

const kb = bytes =>
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} kB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;

async function main() {
  for (const { name } of PACKAGES) {
    if (!existsSync(localPackages[`@gg-web-engine/${name}`])) {
      throw new Error(`packages/${name} is not built. Run \`npm run build\` first.`);
    }
  }
  const version = pkgJson('core').version;
  const lines = [
    START,
    `Measured for ${version} by \`etc/bundle_sizes.mjs\`: minified with esbuild, then gzipped. A package's own`,
    'size keeps every export and leaves out its dependencies; the library it wraps is listed separately. Apps',
    'import less than everything, so their bundles tree-shake below these sums.',
    '',
    '| Package | Own code (gzip) | Wrapped library (gzip) |',
    '|---|---|---|',
  ];
  for (const p of PACKAGES) {
    const own = await measurePackage(p);
    const lib = [
      p.lib && `${kb((await measureLib(p.lib, join(root, 'packages', p.name))).gz)} \`${p.lib}\``,
      p.libNote,
    ].filter(Boolean);
    lines.push(`| \`@gg-web-engine/${p.name}\` | ${kb(own.gz)} | ${lib.join(', ') || '-'} |`);
  }
  // the dev console (core/src/dev) tree-shakes out of an app that never imports GgStatic
  const coreDeps = Object.keys(pkgJson('core').dependencies);
  const coreNoDev = await bundle({
    stdin: {
      contents: ['base', '2d', '3d'].map(d => `export * from './packages/core/dist/${d}';`).join('\n'),
      resolveDir: root,
    },
    external: coreDeps.flatMap(d => [d, `${d}/*`]),
  });
  lines.push(
    '',
    `Core without the dev console (\`GgStatic\`, left out of an app that never imports it) is ${kb(coreNoDev.gz)}.`,
  );
  const rxjs = await measureLib('rxjs');
  lines.push(`Core's own dependency, \`rxjs\`, is ${kb(rxjs.gz)} if imported whole.`);
  lines.push(
    '',
    'The [starter templates](templates/README.md), bundled as complete apps (engine, libraries and game code):',
    '',
  );
  lines.push('| Template | Stack | Whole app (gzip) |', '|---|---|---|');
  for (const t of TEMPLATES) {
    const deps = Object.keys(JSON.parse(readFileSync(join(root, 'templates', t, 'package.json'), 'utf8')).dependencies);
    const stack = deps
      .filter(d => d.startsWith('@gg-web-engine/') && d !== '@gg-web-engine/core')
      .map(d => d.slice(15));
    lines.push(`| \`${t}\` | ${stack.join(' + ')} | ${kb((await measureTemplate(t)).gz)} |`);
  }
  lines.push(END);
  const table = lines.join('\n');

  console.log(table);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Bundle sizes\n\n${table}\n`);
  }
  if (process.argv.includes('--write')) {
    const readme = readFileSync(README, 'utf8');
    const from = readme.indexOf(START);
    const to = readme.indexOf(END);
    if (from < 0 || to < from) throw new Error(`README.md has no ${START} ... ${END} block`);
    writeFileSync(README, readme.slice(0, from) + table + readme.slice(to + END.length));
  }
}

main().catch(e => {
  console.error(e.message ?? e);
  process.exit(1);
});
