import { Screen } from '@gg-web-engine/core';
import { GameScreen } from './game.screen';
import { LIVES } from './level';

/** The title screen: DOM only, no world. */
export class MenuScreen extends Screen {
  // how the dev console's `screens` command names it, also in a minified build
  static readonly screenTypeName: string = 'MenuScreen';

  /** @param error - Shown above the menu: why the game could not start */
  constructor(private readonly error?: string) {
    super();
  }

  enter(): void {
    this.layer.innerHTML = `
      <div class='panel panel--menu'>
        <h1>Coin Hopper</h1>
        <p class='error' hidden></p>
        <button data-action='play'>Play</button>
        <ul class='controls'>
          <li><kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd> move</li>
          <li><kbd>Space</kbd> jump, <kbd>Shift</kbd> run</li>
          <li><kbd>Esc</kbd> / <kbd>P</kbd> pause</li>
        </ul>
        <p>Reach the flag at the end. Collect coins, jump on slimes, mind the spikes and pits:
          you have ${LIVES} lives, and flags on the way are checkpoints.</p>
      </div>`;
    if (this.error) {
      const error = this.layer.querySelector<HTMLElement>('.error')!;
      error.textContent = this.error;
      error.hidden = false;
    }
    // clearHistory: the game becomes the only screen, the menu exits. While the game's enter() is
    // pending, the manager shows its loading view with the progress the game reports.
    const play = () => this.screens.push(new GameScreen(), { clearHistory: true });
    this.layer.querySelector("[data-action='play']")!.addEventListener('click', play);
    this.addTeardown(this.keyboard.bind('Enter').subscribe(down => down && play()));
  }
}
