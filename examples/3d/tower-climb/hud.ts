import { formatTime } from './end.screens';

/** The in-game heads-up display: plain DOM in the game screen's layer, above the canvas. */
export class Hud {
  private readonly crystals: HTMLElement;
  private readonly lives: HTMLElement;
  private readonly time: HTMLElement;
  private readonly message: HTMLElement;
  private messageTimeLeft = 0;

  constructor(layer: HTMLElement) {
    const root = document.createElement('div');
    root.className = 'hud';
    root.innerHTML = `
      <div class='hud__bar'>
        <span data-hud='crystals'></span><span data-hud='lives'></span><span data-hud='time'></span>
      </div>
      <div class='hud__message' hidden></div>`;
    layer.appendChild(root);
    this.crystals = root.querySelector("[data-hud='crystals']")!;
    this.lives = root.querySelector("[data-hud='lives']")!;
    this.time = root.querySelector("[data-hud='time']")!;
    this.message = root.querySelector('.hud__message')!;
  }

  update(state: { crystals: number; totalCrystals: number; lives: number; timeMs: number }): void {
    this.crystals.textContent = `◆ ${state.crystals}/${state.totalCrystals}`;
    this.lives.textContent = '♥'.repeat(state.lives) || '-';
    this.time.textContent = formatTime(state.timeMs);
  }

  /** Shows `text` in the middle of the screen for `seconds` of game time. */
  showMessage(text: string, seconds = 2.5): void {
    this.message.textContent = text;
    this.message.hidden = false;
    this.messageTimeLeft = seconds;
  }

  /** Counts the message down; driven by the game loop, so it freezes while the game is paused. */
  tick(deltaSeconds: number): void {
    if (this.messageTimeLeft > 0 && (this.messageTimeLeft -= deltaSeconds) <= 0) {
      this.message.hidden = true;
    }
  }
}
