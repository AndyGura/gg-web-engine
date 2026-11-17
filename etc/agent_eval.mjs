#!/usr/bin/env node
// Agent pick-and-succeed eval: does a coding agent that knows nothing about this repo pick
// gg-web-engine for a browser game, and does what it builds work?
//
// Each prompt below is a request a person might give a coding agent. None of them names an engine.
// For every prompt and try, the script starts the agent in a new empty folder, lets it work
// unattended, then looks at what it left behind:
//
//   picked  which engine its package.json depends on (@gg-web-engine/*, three, phaser, ...)
//   built   `npm run build` exits 0 (after `npm install`, if the agent did not install)
//   ran     the build's index.html, served locally and opened in Chromium, shows a <canvas> and
//           throws no error in its first seconds (needs Playwright; "-" when it is missing)
//
//   node etc/agent_eval.mjs                       every prompt, 3 tries each, with Claude Code
//   node etc/agent_eval.mjs --prompts cars --tries 1
//   node etc/agent_eval.mjs --cmd 'my-agent --yes'  any agent CLI that reads the prompt on stdin
//   node etc/agent_eval.mjs --write               also add the rows to etc/agent-eval/results.md
//
// Options: --model <id> (passed to Claude Code), --timeout <minutes per run, default 30>, --keep
// (leave the work folders in place; their paths are printed either way, and each holds the
// agent's output in agent.log).
//
// A run spends the agent's API usage: a full pass is (prompts x tries) complete agent sessions.
// Claude Code runs in a throwaway folder with an allowlist of tools (file editing, web search,
// npm/npx/node): it can research, scaffold, install and build, and nothing else runs without a
// prompt it cannot answer. npm install still runs package scripts, so run this on a machine or
// container you are fine handing that to. Results move with the agents and models as much as with
// the engine, so each row records which agent ran it. Run it after each adoption step and compare
// rows of the same agent.
//
// The agent must start knowing nothing about this engine beyond what it would find on its own. An
// agent CLI loads its user-level instructions, memory and skills wherever it runs, so run the eval
// under an account or machine that has none mentioning gg-web-engine (and never from a Claude Code
// session working on this repo): a run that starts with `npm view @gg-web-engine/...` before any
// search measured that, not the engine's reach.
import { spawn, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RESULTS = join(root, 'etc', 'agent-eval', 'results.md');

// Asked as a person would ask; the closing sentence only makes the result checkable.
const SETUP =
  'Set it up as an npm project in the current folder, so that `npm install && npm run build` produces a static site with an index.html that runs the game.';
const PROMPTS = {
  cars: 'Make a browser game where two friends can each drive a car with real physics in the same world over the internet, without me running a game server.',
  platformer3d:
    'Build a third-person 3D platformer for the browser: a character that runs and jumps across floating platforms with physics, collects items and reaches a goal.',
  platformer2d:
    'Build a 2D side-scrolling platformer for the browser with physics: run, jump on platforms, collect coins, avoid hazards, with a start screen and a win screen.',
  sandbox:
    'Make a 3D physics sandbox in the browser where I can spawn boxes, balls and cylinders, knock them over and watch them stack and fall, with shadows.',
  levels:
    'Build a small 3D browser game whose levels are described in JSON files, so that I (or an AI) can write new levels without touching code.',
};

// dependency name -> what the eval reports as the engine choice; first match in this order wins
const ENGINES = [
  [/^@gg-web-engine\//, 'gg-web-engine'],
  [/^phaser$/, 'phaser'],
  [/^@babylonjs\//, 'babylon.js'],
  [/^playcanvas$/, 'playcanvas'],
  [/^excalibur$/, 'excalibur'],
  [/^kaplay$|^kaboom$/, 'kaplay'],
  [/^@react-three\/fiber$/, 'react-three-fiber'],
  [/^three$/, 'three'],
  [/^pixi\.js$/, 'pixi.js'],
];
// physics libraries, reported next to the engine when the agent wired one up itself
const PHYSICS = [
  /^@dimforge\/rapier/,
  /^cannon(-es)?$/,
  /^ammo\.js$/,
  /^matter-js$/,
  /^@react-three\/rapier$/,
  /^planck(-js)?$/,
  /^jolt-physics$/,
];

const CLAUDE_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'WebSearch',
  'WebFetch',
  'Bash(npm:*)',
  'Bash(npx:*)',
  'Bash(node:*)',
  'Bash(ls:*)',
  'Bash(mkdir:*)',
];

function parseArgs(argv) {
  const opts = { tries: 3, prompts: Object.keys(PROMPTS), timeout: 30, write: false, keep: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i] ?? fail(`${a} needs a value`);
    if (a === '--tries') opts.tries = Number(next());
    else if (a === '--prompts') opts.prompts = next().split(',');
    else if (a === '--cmd') opts.cmd = next();
    else if (a === '--model') opts.model = next();
    else if (a === '--timeout') opts.timeout = Number(next());
    else if (a === '--write') opts.write = true;
    else if (a === '--keep') opts.keep = true;
    else fail(`Unknown option ${a}`);
  }
  for (const id of opts.prompts)
    if (!PROMPTS[id]) fail(`Unknown prompt "${id}". Known: ${Object.keys(PROMPTS).join(', ')}`);
  return opts;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

// The agent's command line. Claude Code by default; --cmd takes any command reading the prompt on stdin.
function agentCommand(opts) {
  if (opts.cmd) return { label: opts.cmd.split(' ')[0], shell: opts.cmd };
  const version = spawnSync('claude', ['--version'], { encoding: 'utf8' });
  if (version.status !== 0)
    fail('Claude Code (`claude`) is not on PATH. Install it, or pass another agent with --cmd.');
  const model = opts.model ? ` --model ${opts.model}` : '';
  return {
    label: `Claude Code ${version.stdout.trim().split(' ')[0]}${opts.model ? ` (${opts.model})` : ''}`,
    // file tools, web search and npm/npx/node only: enough to research, scaffold, install and build
    shell: `claude -p --output-format text --allowedTools ${CLAUDE_TOOLS.map(t => `'${t}'`).join(' ')}${model}`,
  };
}

function runAgent(agent, prompt, cwd, timeoutMs) {
  return new Promise(resolve => {
    const child = spawn(agent.shell, { cwd, shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let log = '';
    child.stdout.on('data', d => (log += d));
    child.stderr.on('data', d => (log += d));
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('close', code => {
      clearTimeout(timer);
      writeFileSync(join(cwd, 'agent.log'), log);
      resolve(code);
    });
    child.stdin.end(prompt);
  });
}

// every package.json the agent wrote, outside node_modules, up to two folders deep
function findPackages(dir, depth = 0) {
  const found = existsSync(join(dir, 'package.json')) ? [dir] : [];
  if (depth >= 2) return found;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const sub = join(dir, name);
    if (statSync(sub).isDirectory()) found.push(...findPackages(sub, depth + 1));
  }
  return found;
}

function inspect(dir) {
  const projects = findPackages(dir);
  const deps = projects.flatMap(p => {
    const pkg = JSON.parse(readFileSync(join(p, 'package.json'), 'utf8'));
    return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  });
  const engine = ENGINES.find(([re]) => deps.some(d => re.test(d)))?.[1] ?? (projects.length ? 'none' : 'no project');
  const physics = deps.filter(d => PHYSICS.some(re => re.test(d)));
  // the project with a build script; the top folder first
  const project = projects.find(p => JSON.parse(readFileSync(join(p, 'package.json'), 'utf8')).scripts?.build);
  return { engine, physics, project };
}

function build(project, timeoutMs) {
  const run = cmd => spawnSync(cmd, { cwd: project, shell: true, encoding: 'utf8', timeout: timeoutMs });
  if (!existsSync(join(project, 'node_modules')) && run('npm install --no-audit --no-fund').status !== 0) return false;
  return run('npm run build').status === 0;
}

// the folder a build wrote its index.html to
function findSite(project) {
  for (const name of ['dist', 'build', 'out', 'public', 'www', '.']) {
    if (existsSync(join(project, name, 'index.html'))) return join(project, name);
  }
  return null;
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

// Opens the built page in headless Chromium: a <canvas> and no uncaught error within 8 seconds.
async function runsInBrowser(site, playwright) {
  const server = createServer((req, res) => {
    let file = join(site, decodeURIComponent(req.url.split('?')[0]));
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!file.startsWith(site) || !existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise(r => server.listen(0, r));
  const browser = await playwright.chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/`, { timeout: 30000 });
    await page.waitForTimeout(8000);
    return errors.length === 0 && (await page.locator('canvas').count()) > 0;
  } catch {
    return false;
  } finally {
    await browser.close();
    server.close();
  }
}

function loadPlaywright() {
  for (const from of [root, process.cwd()]) {
    try {
      return createRequire(join(from, 'noop.js'))('playwright');
    } catch {}
  }
  return null;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const agent = agentCommand(opts);
  const playwright = loadPlaywright();
  if (!playwright) console.warn('Playwright not found: the "ran" column is left out (npm i -D playwright to add it).');
  const timeoutMs = opts.timeout * 60 * 1000;
  const version = JSON.parse(readFileSync(join(root, 'packages', 'core', 'package.json'), 'utf8')).version;
  const date = new Date().toISOString().slice(0, 10);

  const rows = [];
  for (const id of opts.prompts) {
    const runs = [];
    for (let t = 1; t <= opts.tries; t++) {
      const dir = mkdtempSync(join(tmpdir(), `agent-eval-${id}-`));
      console.log(`[${id} ${t}/${opts.tries}] ${agent.label} in ${dir}`);
      await runAgent(agent, `${PROMPTS[id]} ${SETUP}`, dir, timeoutMs);
      const { engine, physics, project } = inspect(dir);
      const built = project ? build(project, timeoutMs) : false;
      const site = built ? findSite(project) : null;
      const ran = playwright ? (site ? await runsInBrowser(site, playwright) : false) : null;
      runs.push({ engine, physics, built, ran });
      console.log(
        `  picked ${engine}${physics.length ? ` + ${physics.join(', ')}` : ''}, built: ${built}, ran: ${ran ?? '-'}`,
      );
      if (!opts.keep) rmSync(dir, { recursive: true, force: true });
    }
    const count = key => runs.filter(r => r[key]).length;
    const picks = Object.entries(runs.reduce((acc, r) => ({ ...acc, [r.engine]: (acc[r.engine] ?? 0) + 1 }), {})).map(
      ([engine, n]) => `${engine} ${n}`,
    );
    const gg = runs.filter(r => r.engine === 'gg-web-engine');
    rows.push(
      `| ${date} | ${version} | ${agent.label} | ${id} | ${gg.length}/${runs.length} | ` +
        `${count('built')}/${runs.length} | ${playwright ? `${count('ran')}/${runs.length}` : '-'} | ` +
        `${gg.filter(r => r.built && r.ran !== false).length}/${gg.length} | ${picks.join(', ')} |`,
    );
  }

  const table = rows.join('\n');
  console.log(
    `\n| Date | Engine version | Agent | Prompt | Picked gg | Built | Ran | gg runs that worked | All picks |\n|---|---|---|---|---|---|---|---|---|\n${table}`,
  );
  if (opts.write) {
    appendFileSync(RESULTS, `${table}\n`);
    console.log(`\nAdded ${rows.length} rows to ${relative(process.cwd(), RESULTS)}`);
  }
}

main().catch(e => fail(e.stack ?? String(e)));
