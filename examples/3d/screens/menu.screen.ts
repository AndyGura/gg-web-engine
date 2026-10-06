import { Screen } from '@gg-web-engine/core';
import { GameScreen } from './game.screen';

/** The main menu: DOM only, no world. */
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
        <h1>Screens demo</h1>
        <p class='error' hidden></p>
        <button data-action='play'>Play</button>
        <p>Menu → loading → game → pause → menu, as often as you like</p>
      </div>`;
    if (this.error) {
      const error = this.layer.querySelector<HTMLElement>('.error')!;
      error.textContent = this.error;
      error.hidden = false;
    }
    this.layer.querySelector("[data-action='play']")!.addEventListener('click', () => {
      // clearHistory: the game becomes the only screen, the menu exits. While the game's enter()
      // is pending, the manager shows its loading view with the progress the game reports.
      this.screens.push(new GameScreen(), { clearHistory: true });
    });
  }
}
