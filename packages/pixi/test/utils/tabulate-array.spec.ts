import { tabulateArray } from '../../src/utils/tabulate-array';

describe('tabulateArray', () => {
  it('builds an array of the given length by calling the mapper with each index', () => {
    expect(tabulateArray(5, i => i * 2)).toEqual([0, 2, 4, 6, 8]);
  });

  it('returns an empty array when amount is 0', () => {
    expect(tabulateArray(0, i => i)).toEqual([]);
  });
});
