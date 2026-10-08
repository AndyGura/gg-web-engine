import { wrapPlayhead } from '../../src/utils/playhead';

describe('wrapPlayhead', () => {
  it('runs a non-looping clip to its end, then reports it ended', () => {
    expect(wrapPlayhead(3, 10, false, 0, 0)).toEqual({ offset: 3, ended: false });
    expect(wrapPlayhead(10, 10, false, 0, 0)).toEqual({ offset: 10, ended: true });
    expect(wrapPlayhead(25, 10, false, 0, 0)).toEqual({ offset: 10, ended: true });
  });

  it('wraps a looping clip over the whole clip when no loop region is set', () => {
    expect(wrapPlayhead(23, 10, true, 0, 0).offset).toBeCloseTo(3);
    expect(wrapPlayhead(23, 10, true, 0, 0).ended).toBe(false);
  });

  it('plays the lead-in once, then repeats only the loop region', () => {
    // lead-in 0..2, loop 2..6
    expect(wrapPlayhead(1, 10, true, 2, 6).offset).toBeCloseTo(1);
    expect(wrapPlayhead(5, 10, true, 2, 6).offset).toBeCloseTo(5);
    expect(wrapPlayhead(7, 10, true, 2, 6).offset).toBeCloseTo(3);
    expect(wrapPlayhead(14, 10, true, 2, 6).offset).toBeCloseTo(2);
  });

  it('treats loopEnd past the clip as its end and an inverted region as the whole clip', () => {
    expect(wrapPlayhead(12, 10, true, 4, 50).offset).toBeCloseTo(6);
    expect(wrapPlayhead(12, 10, true, 8, 3).offset).toBeCloseTo(2);
  });

  it('never ends a looping clip and clamps negative positions', () => {
    expect(wrapPlayhead(1e6 + 0.5, 1, true, 0, 0).ended).toBe(false);
    expect(wrapPlayhead(-1, 10, false, 0, 0)).toEqual({ offset: 0, ended: false });
  });
});
