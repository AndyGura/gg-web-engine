import { computeDistanceGain } from '../../src/utils/distance-gain';

describe('computeDistanceGain', () => {
  describe('linear model', () => {
    it('returns full gain at or inside refDistance', () => {
      expect(computeDistanceGain(0, 1, 10, 1, 'linear')).toBe(1);
      expect(computeDistanceGain(1, 1, 10, 1, 'linear')).toBe(1);
    });

    it('interpolates linearly toward maxDistance', () => {
      // halfway between refDistance=1 and maxDistance=10 -> gain halfway between 1 and 0
      expect(computeDistanceGain(5.5, 1, 10, 1, 'linear')).toBeCloseTo(0.5, 5);
    });

    it('clamps beyond maxDistance rather than going negative', () => {
      expect(computeDistanceGain(1000, 1, 10, 1, 'linear')).toBeCloseTo(0, 5);
    });

    it('respects a rolloffFactor below 1 (slower falloff)', () => {
      const full = computeDistanceGain(5.5, 1, 10, 1, 'linear');
      const slower = computeDistanceGain(5.5, 1, 10, 0.5, 'linear');
      expect(slower).toBeGreaterThan(full);
    });

    it('returns full gain when maxDistance <= refDistance (degenerate range)', () => {
      expect(computeDistanceGain(5, 5, 5, 1, 'linear')).toBe(1);
    });
  });

  describe('inverse model', () => {
    it('returns full gain at or inside refDistance', () => {
      expect(computeDistanceGain(0, 1, 10, 1, 'inverse')).toBe(1);
      expect(computeDistanceGain(1, 1, 10, 1, 'inverse')).toBe(1);
    });

    it('matches the Web Audio PannerNode inverse formula', () => {
      // refDistance / (refDistance + rolloffFactor * (distance - refDistance))
      const expected = 1 / (1 + 1 * (4 - 1));
      expect(computeDistanceGain(4, 1, 100, 1, 'inverse')).toBeCloseTo(expected, 5);
    });

    it('never fully reaches zero, unlike the linear model', () => {
      expect(computeDistanceGain(1000, 1, 100000, 1, 'inverse')).toBeGreaterThan(0);
    });
  });

  describe('exponential model', () => {
    it('returns full gain at or inside refDistance', () => {
      expect(computeDistanceGain(0, 1, 10, 1, 'exponential')).toBe(1);
      expect(computeDistanceGain(1, 1, 10, 1, 'exponential')).toBe(1);
    });

    it('matches the Web Audio PannerNode exponential formula', () => {
      // (distance / refDistance) ^ -rolloffFactor
      const expected = Math.pow(4 / 1, -1.5);
      expect(computeDistanceGain(4, 1, 100, 1.5, 'exponential')).toBeCloseTo(expected, 5);
    });
  });

  it('clamps distance below refDistance the same way for every model (no gain > 1)', () => {
    for (const model of ['linear', 'inverse', 'exponential'] as const) {
      expect(computeDistanceGain(-5, 1, 10, 1, model)).toBeLessThanOrEqual(1);
    }
  });
});
