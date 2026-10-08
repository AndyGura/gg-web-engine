import { gainFactor } from '../../../src/base/network/net-math';

describe('gainFactor', () => {
  it('closes the same part of a gap per second at any frame rate', () => {
    // regression: `gain * dt` per tick closed 10% more of the gap per second at 30 FPS than at 144
    const remainingAfterOneSecond = (fps: number) => {
      let gap = 1;
      for (let i = 0; i < fps; i++) {
        gap -= gap * gainFactor(6, 1000 / fps);
      }
      return gap;
    };
    for (const fps of [30, 60, 144]) {
      expect(remainingAfterOneSecond(fps)).toBeCloseTo(Math.exp(-6), 6);
    }
  });

  it('stays within [0, 1)', () => {
    expect(gainFactor(6, 0)).toBe(0);
    expect(gainFactor(1000, 1000)).toBeLessThanOrEqual(1);
    expect(gainFactor(0, 16)).toBe(0);
  });
});
