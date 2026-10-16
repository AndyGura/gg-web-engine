import {
  Camera3dEntity,
  CharacterController3dEntity,
  createInlineTickController,
  Gg3dWorld,
  GgStatic,
  LevelJson,
  LoadingScreen,
  PlayerCharacterController,
  Pnt3,
  Point3,
  Trigger3dEntity,
} from '@gg-web-engine/core';
import { MobileControls } from '@gg-web-engine/mobile-controls';
import { ThreeGgWorld, ThreeSceneComponent, ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { createPhysicsWorld } from './backends';
// The level an agent wrote from PROMPT.md, imported as plain JSON: nothing here is level-specific,
// the page only relies on the names the prompt promises (Player, MainCamera, Goal, Checkpoint_N).
import bundledLevel from './level.json';
import promptMd from './PROMPT.md';

// A debugging aid for the demo only: nothing below depends on it.
GgStatic.instance.devConsoleEnabled = true;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---- The prompt panel: PROMPT.md is the prompt, a horizontal rule, then the list of changes ----
const [promptText, changesText = ''] = promptMd.split(/\n---\n/);
$('prompt').textContent = promptText.trim();
// Markdown-light: paragraphs, and "- " bullets whose wrapped lines continue on indented lines.
const element = (tag: string, text: string) => {
  const el = document.createElement(tag);
  el.textContent = text.replace(/\s*\n\s*/g, ' ').replace(/^- /, '');
  return el;
};
$('changes').replaceChildren(
  ...changesText
    .replace(/^#.*$/gm, '') // the section heading; the page has its own
    .trim()
    .split(/\n\s*\n/)
    .map(block => {
      if (!block.startsWith('- ')) return element('p', block);
      const list = document.createElement('ul');
      list.append(...block.split(/\n(?=- )/).map(item => element('li', item)));
      return list;
    }),
);
const panel = $('panel');
panel.hidden = innerWidth < 1000; // open by default where it leaves room for the game
$('toggle').onclick = () => (panel.hidden = !panel.hidden);

// ---- The game: one world per loaded level, disposed (with its canvas) when another is loaded ----
type Game = { world: ThreeGgWorld; canvas: HTMLCanvasElement };
let game: Game | null = null;
let currentLevel: LevelJson = bundledLevel as LevelJson;

async function startGame(levelJson: LevelJson): Promise<void> {
  // Everything of the old level goes with its world: entities, physics, renderer, touch controls.
  game?.world.dispose();
  game?.canvas.remove();
  game = null;
  $('banner').hidden = true;

  const loading = LoadingScreen.show();
  const canvas = document.createElement('canvas');
  $('game').appendChild(canvas);
  const world: ThreeGgWorld = new Gg3dWorld({
    visualScene: new ThreeSceneComponent(),
    physicsWorld: await createPhysicsWorld(),
  });
  game = { world, canvas };
  try {
    await world.init();
    const level = await world.loader.loadLevel(levelJson, 'PromptLevel', {
      onProgress: p => loading.setProgress(p),
    });

    // The page contract: render through the level's camera, drive its player in third person.
    // The controller takes its initial look direction from the camera's rotation.
    const camera = level.getChildEntityByName<Camera3dEntity<ThreeVisualTypeDocRepo>>('MainCamera');
    const renderer = world.addRenderer(camera.camera, canvas);
    const player = level.getChildEntityByName<CharacterController3dEntity>('Player');
    world.addEntity(
      new PlayerCharacterController(world.keyboardInput, player, renderer, {
        viewMode: 'third-person',
        thirdPersonDistance: 5,
        mouseOptions: { canvas },
        ignoreMouseUnlessPointerLocked: true, // click the canvas to look around, Esc to release
      }),
    );
    // On-screen stick and buttons, shown on touch devices only.
    world.addEntity(new MobileControls());

    // Checkpoints: the last one entered is where a fall respawns the player (the start before any).
    let respawnAt: Point3 = player.position;
    let lastCheckpoint = 'start';
    for (const trigger of level.children) {
      if (trigger instanceof Trigger3dEntity && /^Checkpoint_/.test(trigger.name)) {
        trigger.onEntityEntered.subscribe(entity => {
          if (entity === player && lastCheckpoint !== trigger.name) {
            lastCheckpoint = trigger.name;
            respawnAt = trigger.position;
            $('status').textContent = `${trigger.name.replace('_', ' ')} reached`;
          }
        });
      }
    }

    // The goal stops the clock and shows the banner. A level without one just never ends.
    let elapsed = 0;
    let finished = false;
    if (level.children.some(e => e.name === 'Goal')) {
      level.getChildEntityByName<Trigger3dEntity>('Goal').onEntityEntered.subscribe(entity => {
        if (entity === player && !finished) {
          finished = true;
          $('status').textContent = 'Goal reached';
          $('banner-time').textContent = `in ${(elapsed / 1000).toFixed(1)} seconds`;
          $('banner').hidden = false;
          document.exitPointerLock();
        }
      });
    } else {
      $('status').textContent = 'This level has no "Goal" trigger';
    }

    createInlineTickController(world).subscribe(([, delta]) => {
      if (!finished) {
        elapsed += delta;
        $('timer').textContent = `${(elapsed / 1000).toFixed(1)} s`;
      }
      // fell well below the respawn point: put the player back there, motionless
      if (player.position.z < respawnAt.z - 8) {
        player.position = respawnAt;
        player.fallVelocity = Pnt3.O;
        player.airHorizontalVelocity = Pnt3.O;
      }
    });

    world.start();
    $('status').textContent = 'Reach the glowing goal';
    $('error').textContent = '';
  } finally {
    loading.hide();
  }
}

// Load a level; on failure show why in the panel and fall back to the bundled level.
async function load(levelJson: LevelJson): Promise<void> {
  try {
    await startGame(levelJson);
    currentLevel = levelJson;
  } catch (e) {
    console.error(e);
    const message = `Could not load the level: ${e instanceof Error ? e.message : e}`;
    if (levelJson !== bundledLevel) {
      await load(bundledLevel as LevelJson);
    }
    showError(message);
  }
}

function showError(message: string): void {
  $('error').textContent = message;
  panel.hidden = false;
}

// A focused button or textarea keeps key presses from the game (KeyboardInput skips them), so
// every button gives the focus back to the page once clicked.
document.addEventListener('click', e => e.target instanceof HTMLButtonElement && e.target.blur());

$('restart').onclick = () => load(currentLevel);
$('load-default').onclick = () => load(bundledLevel as LevelJson);
$('load').onclick = () => {
  let json: LevelJson;
  try {
    json = JSON.parse($<HTMLTextAreaElement>('custom').value);
  } catch (e) {
    return showError(`Not valid JSON: ${e instanceof Error ? e.message : e}`);
  }
  if (!Array.isArray(json?.entities)) {
    return showError('A level JSON is an object with an "entities" array');
  }
  load(json);
};

await load(currentLevel);
