import { Screen } from '@gg-web-engine/core';
import { GameScreen } from './game.screen';
import { TitleScreen } from './title.screen';

/** What a finished run reports to the screen pushed over it. */
export type RunResult = { timeMs: number; crystals: number; totalCrystals: number };

export function formatTime(ms: number): string {
  const seconds = ms / 1000;
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
}

/**
 * The end of a run, pushed over the frozen game: the manager keeps the game's world paused below
 * it. Both buttons rebuild the whole stack (`reset`), which disposes that world - "again" starts a
 * new GameScreen with a fresh world, rather than resetting the old one.
 */
abstract class EndScreen extends Screen {
  protected abstract title: string;
  protected abstract againLabel: string;

  constructor(protected readonly result: RunResult) {
    super();
  }

  enter(): void {
    const { timeMs, crystals, totalCrystals } = this.result;
    this.layer.innerHTML = `
      <div class='panel panel--overlay'>
        <h1>${this.title}</h1>
        <p>Time ${formatTime(timeMs)} · Crystals ${crystals}/${totalCrystals}</p>
        <button data-action='again'>${this.againLabel}</button>
        <button data-action='menu'>Main menu</button>
      </div>`;
    this.layer
      .querySelector("[data-action='again']")!
      .addEventListener('click', () => this.screens.reset([new GameScreen()]));
    this.layer
      .querySelector("[data-action='menu']")!
      .addEventListener('click', () => this.screens.reset([new TitleScreen()]));
  }
}

export class WinScreen extends EndScreen {
  static readonly screenTypeName: string = 'WinScreen';
  protected title = 'The beacon is lit!';
  protected againLabel = 'Play again';
}

export class GameOverScreen extends EndScreen {
  static readonly screenTypeName: string = 'GameOverScreen';
  protected title = 'Game over';
  protected againLabel = 'Try again';
}
