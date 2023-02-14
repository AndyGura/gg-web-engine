import { IController } from './i-controller';
import { BehaviorSubject, finalize, Observable } from 'rxjs';

export class KeyboardController implements IController {

  private bindings: { [code: string]: BehaviorSubject<boolean>[] } = {};

  constructor() {
    this.handleKeys = this.handleKeys.bind(this);
  }

  private _running: boolean = false;
  public get running(): boolean {
    return this._running;
  }

  bind(code: string): Observable<boolean> {
    if (!this.bindings[code]) {
      this.bindings[code] = [];
    }
    const subj = new BehaviorSubject<boolean>(false);
    this.bindings[code].push(subj);
    return subj.pipe(finalize(() => this.bindings[code].splice(this.bindings[code].indexOf(subj), 1)));
  }

  async start() {
    if (this.running) {
      return;
    }
    window.addEventListener('keydown', this.handleKeys);
    window.addEventListener('keyup', this.handleKeys);
    this._running = true;
  }

  private handleKeys(e: KeyboardEvent) {
    if (e.type != 'keydown' && e.type != 'keyup') {
      return;
    }
    const pressed = e.type == 'keydown';
    for (const subj of (this.bindings[e.code] || [])) {
      subj.next(pressed);
    }
  }

  async stop() {
    if (!this.running) {
      return;
    }
    window.removeEventListener('keydown', this.handleKeys);
    window.removeEventListener('keyup', this.handleKeys);
    this._running = false;
  }

}
