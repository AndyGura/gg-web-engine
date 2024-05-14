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

  describe('tick rate limit', () => {
    it('should throttle ticks', () => {
      const intermediateClock = new PausableClock(true, gClockMock);
      intermediateClock.tickRateLimit = 10;
      const c1 = new PausableClock(true, intermediateClock);
      const c2 = new PausableClock(true, intermediateClock);
      let caughtTicks1: [number, number][] = [];
      let caughtTicks2: [number, number][] = [];
      c1.tick$.subscribe((x) => {
        caughtTicks1.push(x);
      });
      c2.tick$.subscribe((x) => {
        caughtTicks2.push(x);
      });
      gClockMock._tick$.next([0, 25]);
      gClockMock._tick$.next([25, 50]);
      gClockMock._tick$.next([50, 75]);
      gClockMock._tick$.next([75, 100]);
      gClockMock._tick$.next([100, 125]);
      gClockMock._tick$.next([125, 150]);
      gClockMock._tick$.next([150, 175]);
      gClockMock._tick$.next([175, 200]);
      gClockMock._tick$.next([200, 225]);
      jest.advanceTimersByTime(225);
      expect(caughtTicks1).toHaveLength(2);
      expect(caughtTicks1).toEqual([[100, 100], [200, 100]]);
      expect(c1.elapsedTime).toEqual(225);
      expect(caughtTicks2).toHaveLength(2);
      expect(caughtTicks2).toEqual([[100, 100], [200, 100]]);
      expect(c2.elapsedTime).toEqual(225);
    });
  });

  describe('time scale', () => {
    it('should scale time', () => {
      const c = new PausableClock(true);
      c.timeScale = 2;
      jest.advanceTimersByTime(1500);
      expect(c.elapsedTime).toBe(3000);
    });

    it('should never change elapsed time during time scale', () => {
      const c = new PausableClock(true);
      jest.advanceTimersByTime(5000);
      expect(c.elapsedTime).toBe(5000);

      const runAssertions = (n: number) => {
        expect(c.elapsedTime).toBe(n);
        c.timeScale = 2;
        expect(c.elapsedTime).toBe(n);
        c.timeScale = 0;
        expect(c.elapsedTime).toBe(n);
        c.timeScale = 5;
        expect(c.elapsedTime).toBe(n);
        c.timeScale = -2;
        expect(c.elapsedTime).toBe(n);
        c.timeScale = 0;
        expect(c.elapsedTime).toBe(n);
        c.timeScale = 1;
        expect(c.elapsedTime).toBe(n);
      };

      // running clock changes
      runAssertions(5000);
      // paused clock changes
      c.pause();
      runAssertions(5000);
      jest.advanceTimersByTime(1000);
      runAssertions(5000);
      // resumed clock changes
      c.resume();
      runAssertions(5000);
      jest.advanceTimersByTime(1000);
      runAssertions(6000);
      // stopped clock changes
      c.stop();
      runAssertions(6000);
    });

    it('should scale time after clock was paused beforehand', () => {
      const c = new PausableClock(true);
      jest.advanceTimersByTime(500);
      c.pause();
      jest.advanceTimersByTime(500);
      c.resume();

      expect(c.elapsedTime).toBe(500);
      c.timeScale = 2;
      jest.advanceTimersByTime(1500);
      expect(c.elapsedTime).toBe(3500);
    });

    it('should handle pause/resume correctly with scaled time', () => {
      const c = new PausableClock(true);
      c.timeScale = 3;

      jest.advanceTimersByTime(1000);
      expect(c.elapsedTime).toBe(3000);

      c.pause();
      jest.advanceTimersByTime(1000);
      expect(c.elapsedTime).toBe(3000);

      c.resume();
      expect(c.elapsedTime).toBe(3000);
      jest.advanceTimersByTime(1000);
      expect(c.elapsedTime).toBe(6000);

      c.pause();
      jest.advanceTimersByTime(1000);
      expect(c.elapsedTime).toBe(6000);

      c.resume();
      expect(c.elapsedTime).toBe(6000);
      jest.advanceTimersByTime(1000);
      expect(c.elapsedTime).toBe(9000);
    });

    it('should scale time at the time timeScale was updated', () => {
      const c = new PausableClock(true);
      jest.advanceTimersByTime(1500);
      expect(c.elapsedTime).toBe(1500);
      c.timeScale = 2;
      jest.advanceTimersByTime(1500);
      expect(c.elapsedTime).toBe(4500);
    });

    it('should affect tick delta', () => {
      const c = new PausableClock(true, gClockMock);
      jest.advanceTimersByTime(100);
      const ticks: [number, number][] = [];
      c.tick$.subscribe((x) => ticks.push(x));

      gClockMock._tick$.next([150, 200]);
      c.timeScale = 2;
      gClockMock._tick$.next([200, 250]);
      gClockMock._tick$.next([250, 350]);

      expect(ticks).toEqual([
        [50, 50],
        [150, 100],
        [350, 200],
      ]);
    });

    it('should not update past time', () => {
      const c = new PausableClock(true);
      jest.advanceTimersByTime(1500);
      expect(c.elapsedTime).toBe(1500);
      c.timeScale = 2;
      expect(c.elapsedTime).toBe(1500);
    });

    it('should work with pause feature', () => {
      const c = new PausableClock(true);
      jest.advanceTimersByTime(1500);
      expect(c.elapsedTime).toBe(1500);
      c.pause();
      c.timeScale = 2;
      jest.advanceTimersByTime(500);
      expect(c.elapsedTime).toBe(1500);
      c.resume();
      jest.advanceTimersByTime(500);
      expect(c.elapsedTime).toBe(2500);
    });

    it('should not update last stopped time', () => {
      const c = new PausableClock(true);
      jest.advanceTimersByTime(1500);
      expect(c.elapsedTime).toBe(1500);
      c.stop();
      c.timeScale = 2;
      expect(c.elapsedTime).toBe(1500);
    });

    it('should be able to set negative time scale', () => {
      const c = new PausableClock(true);

      jest.advanceTimersByTime(1500);
      expect(c.elapsedTime).toBe(1500);
      c.timeScale = -0.5;
      expect(c.elapsedTime).toBe(1500);

      jest.advanceTimersByTime(1000);
      expect(c.elapsedTime).toBe(1000);
      c.timeScale = 1;
      expect(c.elapsedTime).toBe(1000);

      jest.advanceTimersByTime(500);
      expect(c.elapsedTime).toBe(1500);
    });

    it('time scale 0 should pause clock', () => {
      const c = new PausableClock(true);
      jest.advanceTimersByTime(1500);
      expect(c.elapsedTime).toBe(1500);
      c.timeScale = 0;
      expect(c.isPaused).toBeTruthy();
    });

    it('should unpause clock after changing time scale from 0', () => {
      const c = new PausableClock(true);

      jest.advanceTimersByTime(1500);
      c.timeScale = 0;

      jest.advanceTimersByTime(1500);
      expect(c.elapsedTime).toBe(1500);
      c.timeScale = 1;
      expect(c.isPaused).toBeFalsy();
      expect(c.elapsedTime).toBe(1500);

      jest.advanceTimersByTime(1500);
      expect(c.elapsedTime).toBe(3000);
    });
  });

  describe('clocks hierarchy', () => {
    it('should propagate ticks from parent clock', () => {
      const parent = new PausableClock(true, gClockMock);
      const child = new PausableClock(true, parent);
      let tickData = null;
      child.tick$.subscribe((x) => {
        tickData = x;
      });
      gClockMock._tick$.next([0, 0]);
      expect(tickData).toEqual([0, 0]);
    });

    it('should not propagate ticks from paused parent clock', () => {
      const parent = new PausableClock(true, gClockMock);
      parent.pause();
      const child = new PausableClock(true, parent);
      let tickData = null;
      child.tick$.subscribe((x) => {
        tickData = x;
      });
      gClockMock._tick$.next([0, 0]);
      expect(tickData).toEqual(null);
      expect(child.isPaused).toBe(false);
    });

    it('timescale should affect children', () => {
      const parent = new PausableClock(true, gClockMock);
      jest.advanceTimersByTime(1500);
      expect(parent.elapsedTime).toBe(1500);
      const child = new PausableClock(true, parent);
      jest.advanceTimersByTime(1500);
      expect(parent.elapsedTime).toBe(3000);
      expect(child.elapsedTime).toBe(1500);

      parent.timeScale = 2;
      jest.advanceTimersByTime(1000);
      expect(parent.elapsedTime).toBe(5000);
      expect(child.elapsedTime).toBe(3500);
    });
  });

});
