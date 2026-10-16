import {
  Camera3dEntity,
  CharacterController3dEntity,
  createInlineTickController,
  Entity3d,
  Gg3dWorld,
  PlayerCharacterController,
  Pnt3,
  Point3,
  Qtrn,
  Screen,
  ScreenEnterContext,
} from '@gg-web-engine/core';
import { MobileControls, TouchButton } from '@gg-web-engine/mobile-controls';
import { ThreeGgWorld, ThreeSceneComponent, ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { createPhysicsWorld } from './backends';
import { createCrystal, CrystalSettings } from './crystal';
import { createEffects, paintSky } from './effects';
import { GameOverScreen, RunResult, WinScreen } from './end.screens';
import { Hud } from './hud';
import { BEACON, CHECKPOINTS, FALL_DEPTH, LEVEL } from './level';
import { PauseScreen } from './pause.screen';

const LIVES = 3;
const PICKUP_DISTANCE = 1.2;
/** How close (horizontally) to a checkpoint's / the beacon's center counts as standing there. */
const CHECKPOINT_RADIUS = 1.6;
const BEACON_RADIUS = 1.4;
/** Q / E turning speed, radians per second - for playing without a mouse. */
const TURN_SPEED = 2.2;

const horizontalDistance = (a: Point3, b: Point3) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * One run of the game. Everything it creates lives in its own layer and is registered with the
 * screen, so leaving it (pause → main menu, or the win/game over screens' buttons) frees the world
 * and its renderer without any cleanup code here; "play again" is simply a new GameScreen.
 */
export class GameScreen extends Screen {
  static readonly screenTypeName: string = 'GameScreen';
  private pausing = false;
  private finished = false;

  async enter(ctx: ScreenEnterContext): Promise<void> {
    // A canvas of this screen's own: it is removed with the layer when the screen exits.
    const canvas = document.createElement('canvas');
    this.layer.appendChild(canvas);

    // addWorld right away, before anything else can fail or be aborted: from here on the manager
    // disposes the world whenever this screen goes, and pauses it while it is covered.
    const world: ThreeGgWorld = this.addWorld(
      new Gg3dWorld({ visualScene: new ThreeSceneComponent(), physicsWorld: await createPhysicsWorld() }),
    );
    await world.init();

    // The renderer comes before the level, so shaders are compiled as part of loading.
    const camera = new Camera3dEntity<ThreeVisualTypeDocRepo>(
      world.visualScene.factory.createPerspectiveCamera({ fov: 70, frustrum: { near: 0.05, far: 200 } }),
    );
    // PlayerCharacterController starts looking where the camera looks: towards pad 1, a bit down
    camera.rotation = Qtrn.lookAt({ x: 0, y: -6, z: 4 }, { x: 0, y: 4, z: 1 });
    world.addEntity(camera);
    const renderer = world.addRenderer(camera.camera, canvas);

    // The level's app-defined "Crystal" class (see crystal.ts and level.ts).
    world.loader.registerClass('Crystal', (w: ThreeGgWorld, settings: CrystalSettings) => createCrystal(w, settings));
    const level = await world.loader.loadLevel(LEVEL, 'Level', { onProgress: ctx.reportProgress, signal: ctx.signal });

    paintSky(world);

    const player = level.getChildEntityByName<CharacterController3dEntity>('Player');
    const controller = new PlayerCharacterController(world.keyboardInput, player, renderer, {
      viewMode: 'third-person',
      thirdPersonDistance: 6,
      thirdPersonHeight: 1,
      toggleViewKey: null,
      mouseOptions: { canvas },
      ignoreMouseUnlessPointerLocked: true,
    });
    world.addEntity(controller);

    // Touch controls (shown on touch devices only) go into this screen's layer, so a screen pushed
    // on top is above them; they follow the character controller's layout, plus a pause button.
    const controls = new MobileControls({ container: this.layer });
    controls.addControls(
      new TouchButton({ id: 'pause', content: 'II', placement: { top: 1, right: 1 } }).onPress(() => this.pause()),
    );
    world.addEntity(controls);

    // Escape pauses. With the pointer locked the browser keeps Escape for itself and only releases
    // the lock, so losing the lock pauses as well.
    this.addTeardown(this.keyboard.bind('Escape').subscribe(down => down && this.pause()));
    const onPointerLockChange = () => !document.pointerLockElement && this.pause();
    document.addEventListener('pointerlockchange', onPointerLockChange);
    this.addTeardown(() => document.removeEventListener('pointerlockchange', onPointerLockChange));

    // Q / E turn the view, so the game is playable with the keyboard alone. Gameplay keys go on the
    // world's keyboard, which the manager switches off while another screen is on top.
    let turnLeft = false;
    let turnRight = false;
    world.keyboardInput.bind('KeyQ').subscribe(down => (turnLeft = down));
    world.keyboardInput.bind('KeyE').subscribe(down => (turnRight = down));

    // --- game state ------------------------------------------------------------------------------
    const crystals = level.children.filter((e): e is Entity3d => /^Crystal\d+$/.test(e.name));
    const totalCrystals = crystals.length;
    const beaconCrystal = level.getChildEntityByName<Entity3d>('BeaconCrystal');
    beaconCrystal.visible = false; // lit once every crystal is collected
    const effects = createEffects(world, BEACON);
    const hud = new Hud(this.layer);
    let lives = LIVES;
    let checkpoint = 0;
    let timeMs = 0;
    const result = (): RunResult => ({ timeMs, crystals: totalCrystals - crystals.length, totalCrystals });

    const respawn = () => {
      player.position = CHECKPOINTS[checkpoint];
      player.fallVelocity = Pnt3.O;
      player.airHorizontalVelocity = Pnt3.O;
      effects.burst(CHECKPOINTS[checkpoint], 0xffffff, 40, 2);
    };

    const end = (screen: Screen) => {
      this.finished = true;
      // the manager pauses this world (timer included) once the screen is covered
      this.screens.push(screen);
    };

    // The game rules, once per tick. The world's clock stops while the game is paused, and with it
    // this loop and the timer.
    createInlineTickController(world).subscribe(([, delta]) => {
      if (this.finished) {
        return;
      }
      timeMs += delta;
      hud.tick(delta / 1000);
      const turn = Number(turnLeft) - Number(turnRight);
      if (turn !== 0) {
        controller.lookDirection = Pnt3.rotAround(controller.lookDirection, Pnt3.Z, turn * TURN_SPEED * (delta / 1000));
      }
      const at = player.position;

      // crystals: pick up whatever the player touches
      for (const crystal of crystals.filter(c => Pnt3.dist(c.position, at) < PICKUP_DISTANCE)) {
        crystals.splice(crystals.indexOf(crystal), 1);
        effects.burst(crystal.position, 0x4cc9f0);
        world.removeEntity(crystal, true);
        if (crystals.length === 0) {
          beaconCrystal.visible = true;
          effects.lightBeacon();
          effects.burst(beaconCrystal.position, 0xffd166, 120, 6);
          hud.showMessage('All crystals found - the beacon is lit! Reach the top!');
        } else {
          hud.showMessage(`Crystal! ${crystals.length} to go`, 1.5);
        }
      }

      // checkpoints: standing on a later one makes it the respawn point
      const next = CHECKPOINTS[checkpoint + 1];
      if (next && player.isGrounded && horizontalDistance(at, next) < CHECKPOINT_RADIUS && at.z > next.z - 0.5) {
        checkpoint++;
        effects.burst(next, 0x2a9d8f, 80);
        hud.showMessage('Checkpoint!', 1.5);
      }

      // the beacon: touching it wins, once it is lit
      if (horizontalDistance(at, BEACON) < BEACON_RADIUS && at.z > BEACON.z - 0.5) {
        if (crystals.length === 0) {
          effects.burst(beaconCrystal.position, 0xffd166, 200, 8);
          end(new WinScreen(result()));
          return;
        }
        hud.showMessage(`The beacon is dark: ${crystals.length} crystals left`, 0.5);
      }

      // falling: too far below the last checkpoint costs a life
      if (at.z < CHECKPOINTS[checkpoint].z - FALL_DEPTH) {
        lives--;
        if (lives === 0) {
          end(new GameOverScreen(result()));
          return;
        }
        respawn();
        hud.showMessage(lives === 1 ? 'Last life!' : `Ouch! ${lives} lives left`);
      }
      hud.update({ crystals: totalCrystals - crystals.length, totalCrystals, lives, timeMs });
    });

    hud.update({ crystals: 0, totalCrystals, lives, timeMs });
    hud.showMessage('Collect every crystal, then light the beacon at the top', 4);
    world.start();
  }

  private pause(): void {
    // Only the screen on top pauses, and never once the run is over: this also runs when a screen
    // pushed on top releases the pointer lock. Escape and the lock release can come in the same
    // moment, before the first push has covered this screen, so a push under way counts too.
    if (this.state !== 'active' || this.pausing || this.finished) {
      return;
    }
    this.pausing = true;
    this.screens.push(new PauseScreen()).finally(() => (this.pausing = false));
  }
}
