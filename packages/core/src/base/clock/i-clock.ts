import { Observable } from 'rxjs';
import { PausableClock } from './pausable-clock';

export interface IClock {
  get tick$(): Observable<[number, number]>;
  get elapsedTime(): number;
  createChildClock(autoStart: boolean): PausableClock;
}
