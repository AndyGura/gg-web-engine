import { Screen } from '@gg-web-engine/core';
import { GameScreen } from './game.screen';

/** The main menu: DOM only, no world. */
export class MenuScreen extends Screen {
  enter(): void {
    this.layer.innerHTML = `
      <div class='panel panel--menu'>
        <h1>Screens demo</h1>
        <button data-action='play'>Play</button>
        <p>Menu → loading → game → pause → menu, as often as you like</p>
      </div>`;
    this.layer.querySelector("[data-action='play']")!.addEventListener('click', () => {
      // clearHistory: the game becomes the only screen, the menu exits. While the game's enter()
      // is pending, the manager shows its loading view with the progress the game reports.
      this.screens.push(new GameScreen(), { clearHistory: true });
    });
  }
}
