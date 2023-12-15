import { BitMask } from '../../../src/base/data-structures/bitmask';

describe('BitMask', () => {
  describe('full', () => {
    it('should generate a bitmask with all bits set to 1 up to the provided bit count', () => {
      expect(BitMask.full(5)).toEqual(Math.pow(2, 5) - 1);
    });
  });

  describe('pack', () => {
    it('should pack an array of bit indices into a single number', () => {
      expect(BitMask.pack([0, 1, 2], 5)).toEqual(7);
    });

    it('should throw an error when a bit index is larger than allowed', () => {
      expect(() => BitMask.pack([0, 1, 6], 5)).toThrowError(new Error('Too big bit index'));
    });
  });

  describe('unpack', () => {
    it('should unpack a bitmask into an array of bit indices', () => {
      expect(BitMask.unpack(7, 5)).toEqual([0, 1, 2]);
    });

    it('should return an empty array when mask is 0', () => {
      expect(BitMask.unpack(0, 5)).toEqual([]);
    });
    it('should cut off excess bits', () => {
      expect(BitMask.unpack(1023, 5)).toEqual([0, 1, 2, 3, 4]);
    });
  });
});
