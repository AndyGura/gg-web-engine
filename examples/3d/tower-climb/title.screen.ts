import { Screen } from '@gg-web-engine/core';
import { GameScreen } from './game.screen';

/** The title screen: DOM only, no world. */
export class TitleScreen extends Screen {
  // how the dev console's `screens` command names it, also in a minified build
  static readonly screenTypeName: string = 'TitleScreen';

  /** @param error - Shown above the menu: why the game could not start */
  constructor(private readonly error?: string) {
    super();
  }

  enter(): void {
    this.layer.innerHTML = `
      <div class='panel panel--title'>
        <h1>Tower Climb</h1>
        <p>Climb the floating tower, collect every crystal and light the beacon at the top.</p>
        <p class='error' hidden></p>
        <button data-action='play'>Play</button>
        <p class='controls'>
          WASD / arrows move · Shift run · Space jump · Q / E or mouse turn<br />
          Click the game to look around with the mouse · Esc pauses
        </p>
      </div>`;
    if (this.error) {
      const error = this.layer.querySelector<HTMLElement>('.error')!;
      error.textContent = this.error;
      error.hidden = false;
    }
    this.layer.querySelector("[data-action='play']")!.addEventListener('click', () => {
      // clearHistory: the game becomes the only screen. While its enter() is pending, the manager
      // shows its loading view with the progress the game reports.
      this.screens.push(new GameScreen(), { clearHistory: true });
    });
  }
}
