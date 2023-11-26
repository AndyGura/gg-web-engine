import { Gg3dWorld, GgDebuggerUI } from '@gg-web-engine/core';
import { filter } from 'rxjs';
import { ThreeSceneComponent } from '@gg-web-engine/three';
import { AmmoWorldComponent } from '@gg-web-engine/ammo';
import { GameFactory } from './game-factory';
import { GameRunner } from './game-runner';

const world = new Gg3dWorld(
  new ThreeSceneComponent(),
  new AmmoWorldComponent(),
);
GgDebuggerUI.instance.createUI();

const initGame = async () => {
  document.getElementById('pause-overlay').style.display = 'none';

  const factory: GameFactory = new GameFactory(world);
  const [renderer, cityMapGraph, mapBounds] = await factory.initGame(document.getElementById('gg')! as HTMLCanvasElement);
  await factory.spawnLambo();

  const runner = new GameRunner(world, renderer, cityMapGraph, mapBounds);
  await runner.audio.initAudio();
  runner.setupKeyBindings();

  world.keyboardInput.bind('KeyX').pipe(filter(x => x)).subscribe(() => {
    const em = document.getElementById('helper-overlay');
    em.style.display = em.style.display === 'none' ? 'flex' : 'none';
  });
  let paused = false;
  world.keyboardInput.bind('KeyP').pipe(filter(x => x)).subscribe(() => {
    paused = !paused;
    if (paused) {
      world.pauseWorld();
    } else {
      world.resumeWorld();
    }
    document.getElementById('pause-overlay').style.display = paused ? 'flex' : 'none';
  });

  world.keyboardInput.bind('KeyL').pipe(filter(x => x)).subscribe(() => {
    runner?.stopGame();
    initGame().then();
  });
  world.start();
};

initGame().then();
