import { AUDIBLE_VOICE_BIAS, compareVoices, rankVoices, VoiceCandidate } from '../../src/utils/voice-ranking';

const voice = (name: string, priority: number, gain: number, audible = false, order = 0) => ({
  name,
  priority,
  gain,
  audible,
  order,
});
const names = (list: { name: string }[]) => list.map(v => v.name);

describe('rankVoices', () => {
  it('keeps every candidate when the budget is not exceeded', () => {
    const candidates = [voice('a', 0, 1), voice('b', 0, 1)];
    expect(rankVoices(candidates, Infinity)).toEqual({ audible: candidates, virtual: [] });
    expect(rankVoices(candidates, 2).virtual).toEqual([]);
  });

  it('ranks by priority first, then by gain', () => {
    const { audible, virtual } = rankVoices(
      [
        voice('quiet-horn', 100, 0.1),
        voice('loud-engine', 50, 1),
        voice('near-engine', 50, 0.9),
        voice('click', 30, 1),
      ],
      2,
    );
    expect(names(audible)).toEqual(['quiet-horn', 'loud-engine']);
    expect(names(virtual)).toEqual(['near-engine', 'click']);
  });

  it('puts silent sources last whatever their priority', () => {
    const { audible } = rankVoices([voice('muted-squeal', 70, 0), voice('engine', 50, 0.5)], 1);
    expect(names(audible)).toEqual(['engine']);
  });

  it('lets an already-audible source keep its voice against a slightly louder one', () => {
    const slightlyLouder = 1.1;
    expect(slightlyLouder).toBeLessThan(AUDIBLE_VOICE_BIAS);
    expect(names(rankVoices([voice('new', 0, slightlyLouder), voice('heard', 0, 1, true)], 1).audible)).toEqual([
      'heard',
    ]);
    expect(names(rankVoices([voice('new', 0, 2), voice('heard', 0, 1, true)], 1).audible)).toEqual(['new']);
  });

  it('breaks full ties by the source already heard, then by the older one', () => {
    expect(names(rankVoices([voice('b', 0, 0, false, 1), voice('a', 0, 0, false, 0)], 1).audible)).toEqual(['a']);
    expect(names(rankVoices([voice('b', 0, 0, true, 1), voice('a', 0, 0, false, 0)], 1).audible)).toEqual(['b']);
  });

  it('orders Infinity priority first and allows a budget of zero', () => {
    const a: VoiceCandidate = voice('a', Infinity, 0.5);
    const b: VoiceCandidate = voice('b', 1e9, 1);
    expect(compareVoices(a, b)).toBeLessThan(0);
    expect(rankVoices([a, b], 0)).toEqual({ audible: [], virtual: [a, b] });
  });
});
