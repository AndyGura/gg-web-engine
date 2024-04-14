import { IClock, PausableClock } from '../../../src';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';

describe('PausableClock', () => {

  class GlobalClockMock implements IClock {
    public readonly _tick$: Subject<[number, number]> = new Subject<[number, number]>();

    public get tick$(): Observable<[number, number]> {
      return this._tick$.pipe(map(([oldTime, newTime]) => [newTime, newTime - oldTime]));
    }

    public get elapsedTime(): number {
      return (typeof performance === 'undefined' ? Date : performance).now();
    }

    createChildClock(autoStart: boolean): PausableClock {
      return new PausableClock(autoStart, this);
    }
  }

  const gClockMock = new GlobalClockMock();

  beforeEach(() => {
    jest.useFakeTimers({
      now: new Date('2024/04/14 00:00:00.000Z'),
    });
  });

  describe('ticks', () => {
    it('should propagate ticks from parent clock', () => {
      const c = new PausableClock(true, gClockMock);
      let tickData = null;
      c.tick$.subscribe((x) => {
        tickData = x;
      });
      gClockMock._tick$.next([0, 0]);
      expect(tickData).toEqual([0, 0]);
    });

    it('should not propagate ticks if not started', () => {
      const c = new PausableClock(false, gClockMock);
      let tickData = null;
      c.tick$.subscribe((x) => {
        tickData = x;
      });
      gClockMock._tick$.next([0, 0]);
      expect(tickData).toBe(null);
    });

    it('should propagate ticks if paused', () => {
      const c = new PausableClock(true, gClockMock);
      let tickData = null;
      c.tick$.subscribe((x) => {
        tickData = x;
      });
      c.pause();
      gClockMock._tick$.next([0, 0]);
      expect(tickData).toBe(null);
    });

    it('should propagate ticks if stopped', () => {
      const c = new PausableClock(true, gClockMock);
      let tickData = null;
      c.tick$.subscribe((x) => {
        tickData = x;
      });
      c.stop();
      gClockMock._tick$.next([0, 0]);
      expect(tickData).toBe(null);
    });
  });

  describe('elapsed time', () => {
    it('should track elapsed time', () => {
      const c = new PausableClock(true);
      jest.advanceTimersByTime(1500);
      expect(c.elapsedTime).toBe(1500);
    });

    it('should return 0 if not started', () => {
      const c = new PausableClock(false);
      jest.advanceTimersByTime(1500);
      expect(c.elapsedTime).toBe(0);
    });

    it('should freeze value when paused', () => {
      const c = new PausableClock(true);
      jest.advanceTimersByTime(1500);
      c.pause();
      jest.advanceTimersByTime(1500);
      expect(c.elapsedTime).toBe(1500);
      c.resume();
      jest.advanceTimersByTime(1500);
      expect(c.elapsedTime).toBe(3000);
    });

    it('should persist after stopped', () => {
      const c = new PausableClock(true);
      jest.advanceTimersByTime(1500);
      expect(c.elapsedTime).toBe(1500);
      c.stop();
      expect(c.elapsedTime).toBe(1500);
    });

    it('should reset when started again', () => {
      const c = new PausableClock(true);
      jest.advanceTimersByTime(1500);
      c.stop();
      expect(c.elapsedTime).toBe(1500);
      c.start();
      expect(c.elapsedTime).toBe(0);
      jest.advanceTimersByTime(1500);
      expect(c.elapsedTime).toBe(1500);
    });
  });
});
