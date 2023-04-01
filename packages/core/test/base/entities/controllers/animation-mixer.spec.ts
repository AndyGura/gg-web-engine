import { AnimationFunction, AnimationMixer } from '../../../../src/base/entities/controllers/animation-mixer';
import { lerpNumber } from '../../../../src';
import { firstValueFrom, timeout } from 'rxjs';

describe(`AnimationMixer<T>`, () => {

  class NumberMixer extends AnimationMixer<number> {
    constructor(protected _animationFunction: AnimationFunction<number>) {
      super(_animationFunction, lerpNumber);
    }
  }

  describe(`output value`, () => {
    it(`should return value via observable`, async () => {
      const mixer = new NumberMixer(() => 3);
      const prom = firstValueFrom(mixer.value$);
      mixer.onSpawned(null!);
      mixer.tick$.next([0, 1]);
      await expect(prom).resolves.toBe(3);
    });
    it(`should sent correct values`, async () => {
      const mixer = new NumberMixer((elapsed, _) => elapsed % 80);
      const emittedValues: number[] = [];
      const sub = mixer.value$.subscribe(v => emittedValues.push(v));
      mixer.onSpawned(null!);
      mixer.tick$.next([0, 100]);
      mixer.tick$.next([100, 100]);
      mixer.tick$.next([200, 100]);
      sub.unsubscribe();
      expect(emittedValues).toEqual([0, 20, 40]);
    });
    it(`should work after removed and put back in`, async () => {
      const mixer = new NumberMixer(() => 3);
      const prom = firstValueFrom(mixer.value$);
      mixer.onSpawned(null!);
      mixer.onRemoved();
      mixer.onSpawned(null!);
      mixer.tick$.next([0, 1]);
      await expect(prom).resolves.toBe(3);
    });
    it(`should not do anything if not spawned`, async () => {
      const mixer = new NumberMixer(() => 3);
      const prom = firstValueFrom(mixer.value$.pipe(timeout(500)));
      mixer.tick$.next([0, 1]);
      await expect(prom).rejects.toThrowError('Timeout has occurred');
    });
    it(`should not do anything after removed from world`, async () => {
      const mixer = new NumberMixer(() => 3);
      const prom = firstValueFrom(mixer.value$.pipe(timeout(500)));
      mixer.onSpawned(null!);
      mixer.onRemoved();
      mixer.tick$.next([0, 1]);
      await expect(prom).rejects.toThrowError('Timeout has occurred');
    });
  });

  describe(`animationFunction`, () => {
    it(`should be able to change animation function immediately`, async () => {
      const mixer = new NumberMixer(() => 3);
      let prom = firstValueFrom(mixer.value$);
      mixer.onSpawned(null!);
      mixer.tick$.next([0, 1]);
      await expect(prom).resolves.toBe(3);
      mixer.animationFunction = () => 5;
      prom = firstValueFrom(mixer.value$);
      mixer.tick$.next([0, 1]);
      await expect(prom).resolves.toBe(5);
    });
    it(`should interrupt transitions if set new function`, async () => {
      const mixer = new NumberMixer(() => 3);
      const emittedValues: number[] = [];
      const sub = mixer.value$.subscribe(v => emittedValues.push(v));
      mixer.onSpawned(null!);
      mixer.tick$.next([0, 100]);
      mixer.transitFromStaticState(10, () => 20, 500);
      mixer.tick$.next([300, 100]);
      expect(mixer.isInTransition).toBe(true);
      mixer.tick$.next([400, 100]);
      mixer.tick$.next([500, 100]);
      mixer.animationFunction = () => 5;
      expect(mixer.isInTransition).toBe(false);
      mixer.tick$.next([600, 100]);
      sub.unsubscribe();
      expect(emittedValues).toEqual([3, 10, 12, 14, 5]);
    });
  });

  describe(`transitFromStaticState`, () => {
    it(`should be able to transfer animation function from static value`, async () => {
      const mixer = new NumberMixer(() => 3);
      const emittedValues: number[] = [];
      const sub = mixer.value$.subscribe(v => emittedValues.push(v));
      mixer.onSpawned(null!);
      mixer.tick$.next([0, 100]);
      mixer.tick$.next([100, 100]);
      mixer.tick$.next([200, 100]);
      mixer.transitFromStaticState(10, () => 20, 500);
      mixer.tick$.next([300, 100]);
      mixer.tick$.next([400, 100]);
      mixer.tick$.next([500, 100]);
      mixer.tick$.next([600, 100]);
      mixer.tick$.next([700, 100]);
      mixer.tick$.next([800, 100]);
      mixer.tick$.next([900, 100]);
      mixer.tick$.next([1000, 100]);
      sub.unsubscribe();
      expect(emittedValues).toEqual([3, 3, 3, 10, 12, 14, 16, 18, 20, 20, 20]);
    });
    it(`should interrupt ongoing transition`, async () => {
      const mixer = new NumberMixer(() => 3);
      const emittedValues: number[] = [];
      const sub = mixer.value$.subscribe(v => emittedValues.push(v));
      mixer.onSpawned(null!);
      mixer.tick$.next([0, 100]);
      mixer.transitFromStaticState(10, () => 20, 500);
      mixer.tick$.next([100, 100]);
      mixer.tick$.next([200, 100]);
      mixer.transitFromStaticState(50, () => 60, 500);
      mixer.tick$.next([300, 100]);
      mixer.tick$.next([400, 100]);
      mixer.tick$.next([500, 100]);
      mixer.tick$.next([600, 100]);
      mixer.tick$.next([700, 100]);
      mixer.tick$.next([800, 100]);
      mixer.tick$.next([900, 100]);
      mixer.tick$.next([1000, 100]);
      sub.unsubscribe();
      expect(emittedValues).toEqual([3, 10, 12, 50, 52, 54, 56, 58, 60, 60, 60]);
    });
  });

  describe(`transitAnimationFunction`, () => {
    it(`should smoothly apply new function`, async () => {
      const mixer = new NumberMixer(() => 50);
      const emittedValues: number[] = [];
      const sub = mixer.value$.subscribe(v => emittedValues.push(v));
      mixer.onSpawned(null!);
      mixer.tick$.next([0, 100]);
      mixer.transitAnimationFunction((elapsed, _) => elapsed, 500);
      mixer.tick$.next([100, 100]); // expected 50: transition k is 0
      mixer.tick$.next([200, 100]); // expected 80: (50 * 0.8 + 200 * 0.2)
      mixer.tick$.next([300, 100]); // expected 150 (50 * 0.6 + 300 * 0.4)
      mixer.tick$.next([400, 100]); // expected 260 (50 * 0.4 + 400 * 0.6)
      mixer.tick$.next([500, 100]); // expected 410 (50 * 0.2 + 500 * 0.8)
      mixer.tick$.next([600, 100]); // expected 600, transition finished
      mixer.tick$.next([700, 100]);
      mixer.tick$.next([800, 100]);
      mixer.tick$.next([900, 100]);
      mixer.tick$.next([1000, 100]);
      sub.unsubscribe();
      expect(emittedValues).toEqual([50, 50, 80, 150, 260, 410, 600, 700, 800, 900, 1000]);
    });
    it(`should take variable delta into account when smoothing`, async () => {
      const mixer = new NumberMixer(() => 50);
      const emittedValues: number[] = [];
      const sub = mixer.value$.subscribe(v => emittedValues.push(v));
      mixer.onSpawned(null!);
      mixer.tick$.next([0, 100]);
      mixer.transitAnimationFunction(() => 150, 500);
      mixer.tick$.next([100, 100]);
      mixer.tick$.next([250, 150]);
      mixer.tick$.next([320, 70]);
      mixer.tick$.next([340, 20]);
      mixer.tick$.next([460, 120]);
      mixer.tick$.next([600, 140]);
      mixer.tick$.next([650, 50]);
      sub.unsubscribe();
      expect(emittedValues).toEqual([50, 50, 80, 94, 98, 122, 150, 150]);
    });
    it(`should interrupt ongoing transition, freeze intermediate state`, async () => {
      const mixer = new NumberMixer(() => 50);
      const emittedValues: number[] = [];
      const sub = mixer.value$.subscribe(v => emittedValues.push(v));
      mixer.onSpawned(null!);
      mixer.tick$.next([0, 100]);
      mixer.transitAnimationFunction((elapsed, _) => elapsed, 500);
      mixer.tick$.next([100, 100]); // expected 50: (50 * 1 + 100 * 0)
      mixer.tick$.next([200, 100]); // expected 80: (50 * 0.8 + 200 * 0.2)
      mixer.tick$.next([300, 100]); // expected 150 (50 * 0.6 + 300 * 0.4)
      mixer.transitAnimationFunction((elapsed, _) => (500 - elapsed / 2), 500);
      mixer.tick$.next([400, 100]); // expected 150 (150 * 1 + 300 * 0)
      mixer.tick$.next([500, 100]); // expected 170 (150 * 0.8 + 250 * 0.2)
      mixer.tick$.next([600, 100]); // expected 170 (150 * 0.6 + 200 * 0.4)
      mixer.tick$.next([700, 100]); // expected 150 (150 * 0.4 + 150 * 0.6)
      mixer.tick$.next([800, 100]); // expected 110 (150 * 0.2 + 100 * 0.8)
      mixer.tick$.next([900, 100]); // expected 50 (150 * 0 + 50 * 1)
      mixer.tick$.next([1000, 100]);
      mixer.tick$.next([1100, 100]);
      sub.unsubscribe();
      expect(emittedValues).toEqual([50, 50, 80, 150, 150, 170, 170, 150, 110, 50, 0, -50]);
    });
    it(`interrupt should freeze time reference, not the value`, async () => {
      const mixer = new NumberMixer(() => 50);
      const emittedValues: number[] = [];
      const sub = mixer.value$.subscribe(v => emittedValues.push(v));
      mixer.onSpawned(null!);
      mixer.tick$.next([0, 100]);
      let i = 0;
      mixer.transitAnimationFunction(() => i++, 500);
      mixer.tick$.next([100, 100]);
      mixer.tick$.next([200, 100]);
      mixer.transitAnimationFunction((elapsed, _) => 50, 400);
      mixer.tick$.next([400, 100]);
      mixer.tick$.next([500, 100]);
      mixer.tick$.next([600, 100]);
      mixer.tick$.next([700, 100]);
      mixer.tick$.next([800, 100]);
      mixer.tick$.next([900, 100]);
      sub.unsubscribe();
      expect(emittedValues).toEqual([50, 50, 40.2, 40.4, 42.95, 45.4, 47.75, 50, 50]);
    });
  });
});
