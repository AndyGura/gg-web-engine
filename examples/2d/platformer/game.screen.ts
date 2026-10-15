import {
  CharacterController2dEntity,
  createInlineTickController,
  Entity2d,
  Gg2dWorld,
  Gg2dWorldWithPhysics,
  PlayerCharacterController2d,
  Pnt2,
  Point2,
  Screen,
  ScreenEnterContext,
  TickOrder,
  Trigger2dEntity,
} from '@gg-web-engine/core';
import { MobileControls, TouchButton } from '@gg-web-engine/mobile-controls';
import { PixiGgWorld, PixiSceneComponent } from '@gg-web-engine/pixi';
import { drawClouds, drawConfetti, drawHills, drawSky, drawSoftDot } from './art';
import { createPhysicsWorld } from './backends';
import { Coin, Flag, registerLevelClasses, Slime, Spikes } from './entities';
import { LEVEL, LEVEL_BOUNDS, LIVES, SPAWN_POINT } from './level';
import { PauseScreen } from './pause.screen';
import { ResultScreen } from './result.screen';

/** how long the player blinks, and can't be hurt, after losing a life */
const INVULNERABLE_MS = 1500;
/** how long the game keeps running after the goal or the last life, before the result shows */
const OUTRO_MS = 1200;

/**
 * One run through the level: the only screen with a world. Everything it creates lives in its own
 * layer and is registered with the screen, so leaving the game (to the menu, or "Play again", which
 * replaces it with a fresh GameScreen) frees the world and its renderer without cleanup code here.
 */
export class GameScreen extends Screen {
  static readonly screenTypeName: string = 'GameScreen';
  private pausing = false;

  async enter(ctx: ScreenEnterContext): Promise<void> {
    const canvas = this.layer.appendChild(document.createElement('canvas'));

    // The physics engine picked by `?physics=` (see backends.ts); only its chunk is downloaded.
    // addWorld right away: from here on the manager disposes the world whenever this screen goes,
    // and pauses it while another screen covers it.
    const world: Gg2dWorldWithPhysics<PixiGgWorld> = this.addWorld(
      new Gg2dWorld({ visualScene: new PixiSceneComponent(), physicsWorld: await createPhysicsWorld() }),
    );
    await world.init();

    // a camera zoomed so about 700 px of the level fit vertically, whatever the window size
    const renderer = world.addRenderer(world.visualScene.factory.createCamera(), canvas);
    let viewWidth = 0; // in level pixels
    renderer.rendererSize$.subscribe(size => {
      if (size) {
        renderer.camera.zoom = size.y / 700;
        viewWidth = size.x / renderer.camera.zoom;
      }
    });

    const texture = (canvas: HTMLCanvasElement) => world.visualScene.factory.createTextureFromCanvas(canvas);

    // --- backdrop: a screen-fixed sky, then clouds and two rows of hills scrolling slower than the
    // level as the camera moves (lower parallax reads as farther away; zIndex < 0 is behind the level)
    world.visualScene.setEnvironment({ background: texture(drawSky()) });
    world.addParallaxLayer({ texture: texture(drawClouds()), parallax: 0.1, zIndex: -3, offset: { x: 0, y: -440 } });
    const farHills = texture(
      drawHills('#a8d5a2', [
        [2, 30],
        [5, 12],
      ]),
    );
    world.addParallaxLayer({ texture: farHills, parallax: 0.25, zIndex: -2, offset: { x: 0, y: -360 } });
    const nearHills = texture(
      drawHills('#6fb36b', [
        [3, 25],
        [7, 8],
      ]),
    );
    world.addParallaxLayer({ texture: nearHills, parallax: 0.5, zIndex: -1, offset: { x: 0, y: -250 } });

    // --- the level (level.ts). The classes it uses beyond the built-in ones come from entities.ts.
    registerLevelClasses(world);
    const level = await world.loader.loadLevel(LEVEL, 'Level', { onProgress: ctx.reportProgress, signal: ctx.signal });
    const player = level.getChildEntityByName<CharacterController2dEntity>('Player');
    // keys → character. The controller also moves the camera, keeping the player in the middle of
    // the screen; this game shows more sky than ground, so it places the camera itself, a bit above
    // the player, after the controller has moved it (see "every frame" below)
    const controller = new PlayerCharacterController2d(world.keyboardInput, player, renderer, { cameraSmoothing: 1 });
    world.addEntity(controller);
    let cameraPosition = player.position;
    // Jump buffering: the controller jumps when Space is pressed on the ground. A press a moment too
    // early (just before landing, or on a tick where the physics backend briefly reports the
    // character off the ground) is remembered for a little while and jumps as soon as it can.
    let jumpBuffer = 0; // ms left
    world.keyboardInput.bind('Space').subscribe(down => {
      if (down && !player.isGrounded) {
        jumpBuffer = 150;
      }
    });
    // an eye on the capsule, so it's clear which way the player faces (moved along every tick)
    const eye = new Entity2d({
      object2D: world.visualScene.factory.createCircle(4, { color: 0xffffff, stroke: { width: 2, color: 0x2b1d14 } }),
    });
    eye.object2D!.zIndex = 1;
    world.addEntity(eye);

    // --- particles: one system per look, each a single draw call
    const softDot = texture(drawSoftDot());
    const sparks = world.addParticleSystem(
      { capacity: 300, texture: softDot, blending: 'additive', zIndex: 5 },
      { lifetime: [0.3, 0.7], size: 12, gravity: { x: 0, y: 900 }, drag: 2, opacityOverLife: [1, 0] },
    );
    /** a burst of `count` sparks of `color` flying out of `at` in every direction */
    const burst = (at: Point2, color: number, count = 16) =>
      sparks.emit(count, (p, ctx) => {
        p.position = at;
        p.velocity = Pnt2.rot({ x: ctx.range(150, 400), y: 0 }, ctx.random() * Math.PI * 2);
        p.tint = color;
      });
    const dust = world.addParticleSystem(
      { capacity: 60, texture: softDot, zIndex: 1 },
      { lifetime: 0.4, size: 18, tint: 0xd8cbb5, drag: 4, sizeOverLife: [0.6, 1.6], opacityOverLife: [0.8, 0] },
    );
    const confetti = world.addParticleSystem(
      { capacity: 400, texture: texture(drawConfetti()), zIndex: 6 },
      { lifetime: [1.5, 2.5], size: { x: 10, y: 5 }, gravity: { x: 0, y: 500 }, drag: 1.5, opacityOverLife: [1, 1, 0] },
    );
    const CONFETTI_COLORS = [0xe94f37, 0xffd23f, 0x4cd964, 0x3fa7f5, 0xb36bff];

    // --- HUD: plain DOM in this screen's layer, refreshed every tick
    const hud = this.layer.appendChild(document.createElement('div'));
    hud.className = 'hud';
    const hint = this.layer.appendChild(document.createElement('div'));
    hint.className = 'hint';
    hint.textContent = 'A/D or arrows: move · Space: jump · Shift: run · Esc or P: pause';

    // --- the rules
    const totalCoins = level.children.filter(child => child instanceof Coin).length;
    let coins = 0;
    let lives = LIVES;
    let time = 0; // ms played, not counting pauses (the world clock stops while paused)
    let checkpoint = SPAWN_POINT;
    let invulnerable = 0; // ms left
    let state: 'playing' | 'won' | 'lost' = 'playing';
    let outro = 0; // ms left until the result screen shows
    /** the end of the run: "You win!" or "Game over", pushed over this screen */
    const showResult = () =>
      this.screens.push(new ResultScreen({ won: state === 'won', time, coins, totalCoins }), {
        // a win leaves the game running underneath, so the confetti keeps falling behind the panel
        // (the manager still switches the game's input off while it is covered)
        pauseBelow: state !== 'won',
      });

    const respawn = () => {
      player.position = checkpoint;
      player.fallVelocity = Pnt2.O;
      player.airHorizontalVelocity = Pnt2.O;
      invulnerable = INVULNERABLE_MS;
    };
    /** a hit (spikes, a slime) or a fall: one life less, then back to the last checkpoint */
    const loseLife = () => {
      if (state !== 'playing') return;
      lives--;
      burst(player.position, 0xff4d4d, 24);
      if (lives > 0) {
        respawn();
        return;
      }
      state = 'lost';
      controller.active = false; // stops reading the keys
      player.active = player.visible = false; // gone: not moving (or falling) anymore, not drawn
      outro = OUTRO_MS;
    };
    const hurt = () => invulnerable <= 0 && loseLife();

    const killZone = level.getChildEntityByName<Trigger2dEntity>('KillZone');
    killZone.onEntityEntered.subscribe(entity => entity === player && loseLife());

    for (const child of level.children) {
      if (child instanceof Coin) {
        // the level JSON already removes a touched coin; here we count it and make it sparkle
        child.onCollected.subscribe(coin => {
          coins++;
          burst(coin.position, 0xffd23f);
        });
      } else if (child instanceof Spikes) {
        child.onEntityEntered.subscribe(hurt);
      } else if (child instanceof Slime) {
        child.onEntityEntered.subscribe(() => {
          // coming down onto it from above (the player's middle well above the slime's) squashes it and
          // bounces the player up; anything else hurts
          if (player.actualVelocity.y > 0 && player.position.y < child.position.y - 30) {
            child.squash();
            burst(child.position, 0xb36bff, 20);
            player.fallVelocity = { x: 0, y: -550 };
          } else {
            hurt();
          }
        });
      } else if (child instanceof Flag) {
        child.onReached.subscribe(flag => {
          if (state !== 'playing') return;
          if (!flag.isGoal) {
            checkpoint = { x: flag.position.x, y: -60 };
            burst({ x: flag.position.x + 20, y: -100 }, 0x4cd964, 12);
            return;
          }
          state = 'won';
          controller.active = false;
          outro = OUTRO_MS;
          // confetti: three bursts from above the flag, tumbling as they fall
          for (const dx of [-120, 0, 120]) {
            confetti.emit(60, (p, ctx) => {
              p.position = { x: flag.position.x + dx, y: -260 };
              p.velocity = { x: ctx.range(-350, 350), y: ctx.range(-650, -150) };
              p.tint = CONFETTI_COLORS[Math.floor(ctx.random() * CONFETTI_COLORS.length)];
              p.rotation = ctx.random() * Math.PI;
              p.angularVelocity = ctx.range(-12, 12);
            });
          }
        });
      }
    }

    // every frame, after the character has moved (its own tick comes before the physics step)
    let hudHtml = '';
    let wasGrounded = true;
    let fallSpeed = 0;
    createInlineTickController(world, TickOrder.RENDERING - 20, 'GameRules').subscribe(([, delta]) => {
      // the camera eases towards a point ahead of the player (where it is going) and above it, but
      // never shows what lies beyond the level's ends
      const { left, right } = LEVEL_BOUNDS;
      const targetX = player.position.x + 120 * player.facing;
      const cameraTarget = {
        x: viewWidth >= right - left ? (left + right) / 2 : clamp(targetX, left + viewWidth / 2, right - viewWidth / 2),
        y: player.position.y - 110,
      };
      cameraPosition = Pnt2.lerp(cameraPosition, cameraTarget, 1 - Math.pow(0.9, delta / (1000 / 60)));
      renderer.position = cameraPosition;
      if (state === 'playing') {
        time += delta;
      } else if (outro > 0 && (outro -= delta) <= 0) {
        showResult();
      }
      if (jumpBuffer > 0) {
        jumpBuffer -= delta;
        if (state === 'playing' && player.isGrounded) {
          player.jump();
          jumpBuffer = 0;
        }
      }
      // blink while invulnerable
      invulnerable = Math.max(0, invulnerable - delta);
      const opacity = invulnerable > 0 && Math.floor(invulnerable / 100) % 2 === 0 ? 0.3 : 1;
      player.object2D!.opacity = eye.object2D!.opacity = opacity;
      eye.visible = player.visible;
      eye.position = Pnt2.add(player.position, { x: 7 * player.facing, y: -14 });
      // a puff of dust when landing from a jump or a fall
      if (player.isGrounded && !wasGrounded && fallSpeed > 300) {
        const feet = Pnt2.add(player.position, { x: 0, y: 36 });
        dust.emit(8, (p, ctx) => {
          p.position = feet;
          p.velocity = { x: ctx.range(-160, 160), y: ctx.range(-40, 0) };
        });
      }
      wasGrounded = player.isGrounded;
      fallSpeed = player.actualVelocity.y;

      const html =
        `<span class='lives'>${'♥'.repeat(lives)}<s>${'♥'.repeat(LIVES - lives)}</s></span>` +
        `<span>Coins ${coins}/${totalCoins}</span><span>${formatTime(time)}</span>`;
      if (html !== hudHtml) {
        hud.innerHTML = hudHtml = html;
      }
    });

    // --- pausing: Esc or P on a keyboard, an on-screen button on touch devices. The touch controls
    // go into this screen's layer, so a screen pushed on top is above them.
    const controls = new MobileControls({ container: this.layer });
    controls.addControls(
      new TouchButton({ id: 'pause', content: 'II', placement: { top: 1, right: 1 } }).onPress(
        () => state === 'playing' && this.pause(),
      ),
    );
    world.addEntity(controls);
    for (const key of ['Escape', 'KeyP']) {
      // the screen's own keyboard only runs while this screen is on top
      this.addTeardown(this.keyboard.bind(key).subscribe(down => down && state === 'playing' && this.pause()));
    }

    world.start();
  }

  private pause(): void {
    // only the screen on top pauses, and only once: a push still under way counts as paused
    if (this.state !== 'active' || this.pausing) return;
    this.pausing = true;
    this.screens.push(new PauseScreen()).finally(() => (this.pausing = false));
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** milliseconds as `m:ss.s` */
export function formatTime(ms: number): string {
  const seconds = ms / 1000;
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
}
