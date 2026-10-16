import { Screen } from '@gg-web-engine/core';
import { formatTime, GameScreen } from './game.screen';
import { MenuScreen } from './menu.screen';

export interface GameResult {
  /** reached the goal (`true`), or ran out of lives */
  won: boolean;
  /** ms played */
  time: number;
  coins: number;
  totalCoins: number;
}

/** The end of a run, pushed over the game: "You win!" with the stats, or "Game over". */
export class ResultScreen extends Screen {
  static readonly screenTypeName: string = 'ResultScreen';

  constructor(private readonly result: GameResult) {
    super();
  }

  enter(): void {
    const { won, time, coins, totalCoins } = this.result;
    this.layer.innerHTML = `
      <div class='panel panel--overlay'>
        <h1>${won ? 'You win!' : 'Game over'}</h1>
        ${won ? `<p class='stats'>Time <b>${formatTime(time)}</b> · Coins <b>${coins}/${totalCoins}</b></p>` : ''}
        <button data-action='again'>${won ? 'Play again' : 'Try again'}</button>
        <button data-action='menu'>Main menu</button>
      </div>`;
    // a fresh GameScreen is a fresh run: the old screen's world is disposed with it
    const again = () => this.screens.reset([new GameScreen()]);
    this.layer.querySelector("[data-action='again']")!.addEventListener('click', again);
    this.layer
      .querySelector("[data-action='menu']")!
      .addEventListener('click', () => this.screens.reset([new MenuScreen()]));
    this.addTeardown(this.keyboard.bind('Enter').subscribe(down => down && again()));
  }
}
