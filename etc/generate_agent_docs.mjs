#!/usr/bin/env node
// Generates packages/core/AGENTS.md from the gg-engine-app-development skill, so the guide ships
// inside the published @gg-web-engine/core tarball where any coding agent (not only Claude Code)
// finds it in node_modules. The skill is the single source of truth: edit the skill, then rerun
// this script and commit both files.
//
// Usage:
//   node etc/generate_agent_docs.mjs          write packages/core/AGENTS.md
//   node etc/generate_agent_docs.mjs --check  exit 1 if the committed file differs from the skill
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const SKILL = '.claude/skills/gg-engine-app-development/SKILL.md';
const TARGET = 'packages/core/AGENTS.md';
const REPO_URL = 'https://github.com/AndyGura/gg-web-engine';

/** Returns the skill's markdown body, without its YAML frontmatter. */
function readSkillBody(path = SKILL) {
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
