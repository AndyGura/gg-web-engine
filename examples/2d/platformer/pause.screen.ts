import { Screen } from '@gg-web-engine/core';
import { MenuScreen } from './menu.screen';

/**
 * Pushed on top of the game. The manager has paused the game's world and switched its input off
 * by the time this screen enters; popping this screen gives both back.
 */
export class PauseScreen extends Screen {
  static readonly screenTypeName: string = 'PauseScreen';

  enter(): void {
    this.layer.innerHTML = `
      <div class='panel panel--overlay'>
        <h1>Paused</h1>
        <button data-action='resume'>Resume</button>
        <button data-action='menu'>Main menu</button>
      </div>`;
    this.layer.querySelector("[data-action='resume']")!.addEventListener('click', () => this.screens.pop());
    // Rebuilds the stack in one transition: this screen and the game exit (the game's world is
    // disposed), a fresh menu enters.
    this.layer
      .querySelector("[data-action='menu']")!
      .addEventListener('click', () => this.screens.reset([new MenuScreen()]));
    // The screen's own keyboard runs only while the screen is on top.
    for (const key of ['Escape', 'KeyP']) {
      this.addTeardown(this.keyboard.bind(key).subscribe(down => down && this.screens.pop()));
    }
  }
}
