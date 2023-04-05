import { Input } from './input';
import { BehaviorSubject, combineLatest, finalize, NEVER, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export class KeyboardInput extends Input {
  private bindings: { [code: string]: BehaviorSubject<boolean>[] } = {};

  constructor() {
    super();
    this.handleKeys = this.handleKeys.bind(this);
  }

  protected async startInternal() {
    window.addEventListener('keydown', this.handleKeys);
    window.addEventListener('keyup', this.handleKeys);
  }

  protected async stopInternal() {
    window.removeEventListener('keydown', this.handleKeys);
    window.removeEventListener('keyup', this.handleKeys);
  }

  bind(code: string): Observable<boolean> {
    if (!this.bindings[code]) {
      this.bindings[code] = [];
    }
    const subj = new BehaviorSubject<boolean>(false);
    this.bindings[code].push(subj);
    return subj.pipe(
      finalize(() => {
        this.bindings[code].splice(this.bindings[code].indexOf(subj), 1);
        subj.complete();
      }),
    );
  }

  bindMany(...codes: string[]): Observable<boolean> {
    if (codes.length == 0) {
      console.warn('[KeyboardController] bindMany called without any key code');
      return NEVER;
    }
    if (codes.length == 1) {
      return this.bind(codes[0]);
    }
    const subjects: BehaviorSubject<boolean>[] = [];
    for (const code of codes) {
      if (!this.bindings[code]) {
        this.bindings[code] = [];
      }
      const subj = new BehaviorSubject<boolean>(false);
      this.bindings[code].push(subj);
      subjects.push(subj);
    }
    return combineLatest(subjects).pipe(
      finalize(() => {
        for (let i = 0; i < codes.length; i++) {
          this.bindings[codes[i]].splice(this.bindings[codes[i]].indexOf(subjects[i]), 1);
          subjects[i].complete();
        }
      }),
      map(values => values.includes(true)),
    );
  }

  emulateKeyDown(code: string): void {
    if (!this.running) {
      return;
    }
    for (const subj of this.bindings[code] || []) {
      subj.next(true);
    }
  }

  emulateKeyUp(code: string): void {
    if (!this.running) {
      return;
    }
    for (const subj of this.bindings[code] || []) {
      subj.next(false);
    }
  }

  emulateKeyPress(code: string): void {
    this.emulateKeyDown(code);
    this.emulateKeyUp(code);
  }

  private handleKeys(e: KeyboardEvent) {
    if (e.type != 'keydown' && e.type != 'keyup') {
      return;
    }
    const pressed = e.type == 'keydown';
    for (const subj of this.bindings[e.code] || []) {
      subj.next(pressed);
    }
  }
}
