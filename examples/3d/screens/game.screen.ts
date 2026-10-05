import {
  Camera3dEntity,
  CharacterController3dEntity,
  Gg3dWorld,
  PlayerCharacterController,
  Screen,
  ScreenEnterContext,
} from '@gg-web-engine/core';
import { AmmoWorldComponent } from '@gg-web-engine/ammo';
import { WebAudioScene3dComponent } from '@gg-web-engine/audio';
import { MobileControls, TouchButton } from '@gg-web-engine/mobile-controls';
import { ThreeGgWorld, ThreeSceneComponent, ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { LEVEL } from './level';
import { PauseScreen } from './pause.screen';

/**
 * The game: the only screen with a world. Everything it creates lives in its own layer and is
 * registered with the screen, so leaving the game (to the menu, or by replacing it) frees the
 * world, its renderer and its audio without any cleanup code here.
 */
export class GameScreen extends Screen {
  async enter(ctx: ScreenEnterContext): Promise<void> {
    // A canvas of this screen's own: it is removed with the layer when the screen exits.
    const canvas = document.createElement('canvas');
    this.layer.appendChild(canvas);

    // addWorld right away, before anything can fail or be aborted: from here on the manager
    // disposes the world whenever this screen goes, and pauses and silences it while it is covered.
    const world: ThreeGgWorld = this.addWorld(
      new Gg3dWorld({
        visualScene: new ThreeSceneComponent(),
        physicsWorld: new AmmoWorldComponent(),
        audioScene: new WebAudioScene3dComponent(),
      }),
    );
    await world.init();

    // The renderer comes before the level, so textures and shaders are uploaded to the GPU as part
    // of loading instead of on the first frames of the game.
    const camera = new Camera3dEntity<ThreeVisualTypeDocRepo>(
      world.visualScene.factory.createPerspectiveCamera({ frustrum: { near: 0.05, far: 1000 } }),
    );
    // looking along +Y, level with the horizon (a camera looks down its local -Z, and Z is up)
    camera.rotation = { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 };
    world.addEntity(camera);
    const renderer = world.addRenderer(camera.camera, canvas);

    // One progress for the whole level; the signal cancels the load if the player leaves early.
    const level = await world.loader.loadLevel(LEVEL, 'Level', {
      onProgress: ctx.reportProgress,
      signal: ctx.signal,
    });

    const player = level.getChildEntityByName<CharacterController3dEntity>('Player');
    world.addEntity(
      new PlayerCharacterController(world.keyboardInput, player, renderer, {
        mouseOptions: { canvas },
        ignoreMouseUnlessPointerLocked: true,
      }),
    );

    // Touch controls go into this screen's layer, so a screen pushed on top is above them. They
    // also leave the screen by themselves while the world's input is off.
    const controls = new MobileControls({ container: this.layer });
    controls.addControls(
      new TouchButton({ id: 'pause', content: 'II', placement: { top: 1, right: 1 } }).onPress(() => this.pause()),
    );
    world.addEntity(controls);

    // Escape pauses. With the pointer locked the browser keeps Escape for itself and only releases
    // the lock, so losing the lock pauses as well.
    this.addTeardown(this.keyboard.bind('Escape').subscribe(down => down && this.pause()));
    const onPointerLockChange = () => {
      if (!document.pointerLockElement) {
        this.pause();
      }
    };
    document.addEventListener('pointerlockchange', onPointerLockChange);
    this.addTeardown(() => document.removeEventListener('pointerlockchange', onPointerLockChange));

    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'Click to look around, WASD to move, Space to jump, Esc to pause';
    this.layer.appendChild(hint);

    world.start();
  }

  private pause(): void {
    // only the screen on top pauses: this also runs when the pause screen itself releases the lock
    if (this.state === 'active') {
      this.screens.push(new PauseScreen());
    }
  }
}
