#!/usr/bin/env node
// Generates the engine's documentation for AI coding agents from the gg-engine-app-development
// skill, which stays the single source of truth:
//
// - packages/core/AGENTS.md ships inside the published @gg-web-engine/core tarball, where any
//   coding agent (not only Claude Code) finds it in node_modules. It is committed: edit the skill,
//   rerun this script and commit both files.
// - llms.txt (an index) and llms-full.txt (pitch, install lines, the whole guide and one complete
//   example per dimension) are written into the docs site by documentation/generate.sh at release
//   time, so agents can read the engine in one request before deciding to use it. Not committed.
//
// Usage:
//   node etc/generate_agent_docs.mjs              write packages/core/AGENTS.md
//   node etc/generate_agent_docs.mjs --check      exit 1 if the committed file differs from the skill
//   node etc/generate_agent_docs.mjs --llms DIR   write DIR/llms.txt and DIR/llms-full.txt
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const SKILL = '.claude/skills/gg-engine-app-development/SKILL.md';
const TARGET = 'packages/core/AGENTS.md';
const REPO_URL = 'https://github.com/AndyGura/gg-web-engine';
const SITE_URL = 'https://andygura.github.io/gg-web-engine';
const DEMOS_URL = 'https://gg-web-demos.guraklgames.com';
const LANDING = 'documentation/landing.md';
// One complete, runnable game per dimension, embedded in llms-full.txt straight from examples/ so it
// can't drift from the code that CI builds.
const FULL_EXAMPLES = [
  { dir: 'examples/3d/player-character', title: '3D character game (three.js, Ammo.js or Rapier)' },
  { dir: 'examples/2d/player-character', title: '2D platformer (pixi.js, Matter.js or Rapier)' },
];

/** Returns the skill's markdown body, without its YAML frontmatter. */
function readSkillBody(path = SKILL) {
  return stripFrontmatter(path);
}

function stripFrontmatter(path) {
  const text = readFileSync(repoRoot + path, 'utf8');
  const match = text.match(/^---\n[\s\S]*?\n---\n+/);
  if (!match) {
    throw new Error(`${path} has no YAML frontmatter; expected it to start with a "---" block`);
  }
  return text.slice(match[0].length);
}

function renderAgentsMd() {
  const header = [
    `<!-- Generated from ${SKILL} by etc/generate_agent_docs.mjs. Do not edit by hand: edit the skill and rerun the script. -->`,
    '',
    '> **For AI coding agents building an app or game with `@gg-web-engine/*`.** This is the same',
    '> guide as the `gg-engine-app-development` Claude Code skill, shipped inside',
    '> `@gg-web-engine/core` so it is readable from `node_modules` by any agent. Other skills it',
    `> mentions by name live in [\`.claude/skills\`](${REPO_URL}/tree/main/.claude/skills) of the`,
    `> [repository](${REPO_URL}); the API reference is at https://andygura.github.io/gg-web-engine/.`,
    '',
  ].join('\n');
  return header + '\n' + readSkillBody();
}

/** The docs site's landing page, with images dropped and site-relative links made absolute. */
function renderLanding() {
  return stripFrontmatter(LANDING)
    .replace(/^!\[.*\]\(.*\)\n+/gm, '')
    .replace(/\]\((?!https?:|#)([^)]+)\)/g, (_, path) => `](${SITE_URL}/${path.replace(/(index)?\.md$/, '')})`);
}

function renderExample({ dir, title }) {
  const files = readdirSync(repoRoot + dir)
    .filter(f => f.endsWith('.ts'))
    // index.ts first: it is the entry point, the rest are its helpers
    .sort((a, b) => (a === 'index.ts' ? -1 : b === 'index.ts' ? 1 : a.localeCompare(b)));
  const parts = [
    `## Complete example: ${title}`,
    '',
    `Source: ${REPO_URL}/tree/main/${dir} (live: ${DEMOS_URL}/?example=${dir.replace('examples/', '')}). ` +
      'The page needs a `<canvas id="gg">`. The `GgStatic` lines turn on the stats panel and dev console ' +
      'for development; leave them out of a production build.',
  ];
  for (const file of files) {
    parts.push('', `### ${dir}/${file}`, '', '```typescript', readFileSync(`${repoRoot}${dir}/${file}`, 'utf8').trimEnd(), '```');
  }
  return parts.join('\n');
}

function renderLlmsFull() {
  return [
    '# GG Web Engine: full guide for AI coding agents',
    '',
    `> Generated from the repository (${REPO_URL}) at release time: the docs landing page, the`,
    '> app-development guide (also shipped as `node_modules/@gg-web-engine/core/AGENTS.md`), and one',
    '> complete example game per dimension.',
    '',
    renderLanding().replace(/^# .*\n+/, '').trimEnd(),
    '',
    '---',
    '',
    readSkillBody().trimEnd(),
    '',
    '---',
    '',
    FULL_EXAMPLES.map(renderExample).join('\n\n'),
    '',
  ].join('\n');
}

function renderLlmsIndex() {
  const { examples } = JSON.parse(readFileSync(repoRoot + 'examples/examples.json', 'utf8'));
  const exampleLines = examples.map(
    e => `- [${e.dir.startsWith('2d') ? '2D' : '3D'}: ${e.title}](${REPO_URL}/tree/main/examples/${e.dir}): ${e.description}`,
  );
  return [
    '# GG Web Engine',
    '',
    '> Open-source TypeScript game engine for the browser. Peer-to-peer multiplayer physics with no',
    '> game server, cars and character controllers built in, JSON levels; renders with Three.js (3D)',
    '> or Pixi.js (2D) and simulates with Rapier, Ammo.js (3D) or Matter.js (2D).',
    '',
    'Install `@gg-web-engine/core` plus one renderer and one physics package of the same dimension,',
    'e.g. `npm install @gg-web-engine/core @gg-web-engine/three @gg-web-engine/rapier3d`. 3D worlds are',
    'Z-up. Physics backends of one dimension share an API, but each keeps its own simulation behavior.',
    'The engine is experimental (versions `0.0.N`).',
    '',
    '## Docs',
    '',
    `- [Full guide (llms-full.txt)](${SITE_URL}/llms-full.txt): pitch, install lines, mental model, bootstrap, capabilities, pitfalls and one complete game per dimension, in one file`,
    `- [AGENTS.md](${REPO_URL}/blob/main/packages/core/AGENTS.md): the app-development guide alone; also at \`node_modules/@gg-web-engine/core/AGENTS.md\` after install`,
    `- [README](${REPO_URL}#readme): features, quickstart, when to use it and when not to`,
    `- [API reference](${SITE_URL}/modules/): every package, generated from the TypeScript sources`,
    `- [Changelog](${REPO_URL}/blob/main/CHANGELOG.md)`,
    '',
    '## Examples',
    '',
    ...exampleLines,
    '',
    '## Optional',
    '',
    `- [Level JSON guide](${REPO_URL}/blob/main/.claude/skills/gg-engine-level-json/SKILL.md): authoring levels as JSON, built-in entity classes, blueprints`,
    `- [Multiplayer package](${REPO_URL}/blob/main/packages/multiplayer/README.md): shared physics worlds over WebRTC`,
    `- [Live demos](${DEMOS_URL}/)`,
    '',
  ].join('\n');
}

const llmsIndex = process.argv.indexOf('--llms');
if (llmsIndex !== -1) {
  const dir = process.argv[llmsIndex + 1];
  if (!dir) {
    console.error('--llms needs a target directory, e.g. --llms documentation/docs');
    process.exit(1);
  }
  writeFileSync(`${dir}/llms.txt`, renderLlmsIndex());
  writeFileSync(`${dir}/llms-full.txt`, renderLlmsFull());
  console.log(`wrote ${dir}/llms.txt and ${dir}/llms-full.txt`);
  process.exit(0);
}

const outputs = [{ path: TARGET, render: renderAgentsMd }];

const check = process.argv.includes('--check');
let stale = [];
for (const { path, render } of outputs) {
  const expected = render();
  const absolute = repoRoot + path;
  if (check) {
    if (!existsSync(absolute) || readFileSync(absolute, 'utf8') !== expected) {
      stale.push(path);
    }
  } else {
    writeFileSync(absolute, expected);
    console.log(`wrote ${path}`);
  }
}
if (stale.length) {
  console.error(
    `${stale.join(', ')} is out of date with ${SKILL}.\n` +
      'Run `npm run agents-md` at the repo root and commit the result.',
  );
  process.exit(1);
}
