/**
 * BitMask class provides static methods to manipulate bits in a number.
 */ /**
 * BitMask class provides static methods to manipulate bits in a number.
 */
export class BitMask {
  /**
   * Generates a bitmask with all bits set to 1 upto the provided bit count
   * @param bits - The number of bits to be set to 1
   */
  static full(bits: number) {
    return Math.pow(2, bits) - 1;
  }

  /**
   * Generates an array with elements being consecutive numbers starting from 0 up to the provided number
   * @param bits - The length of the array to be created
   */
  static fullArray(bits: number) {
    return new Array(bits).fill(null).map((_, i) => i);
  }

  /**
   * Packs an array of bit indices into a single number
   * @param value - The bit indices to be set to 1
   * @param bits - The maximum bit index that can be used
   * @throws Will throw an Error if a bit index in `value` is larger than `bits`
   */
  static pack(value: number[], bits: number) {
    let ret = 0;
    for (const g of value) {
      if (g >= bits) {
        throw new Error('Too big bit index');
      }
      ret |= 1 << g;
    }
    return ret;
  }

  /**
   * Unpacks a bitmask into an array of bit indices
   * @param mask - The bit mask to be unpacked
   * @param bits - The number of bits to be unpacked from the mask
   */
  static unpack(mask: number, bits: number) {
    // It's better to keep the ret array capacity as there won't be more bits set than the size itself.
    const ret: number[] = new Array<number>(bits);
    let idx = 0;
    for (let i = 0; i < bits; i++) {
      if (mask & (1 << i)) {
        ret[idx++] = i;
      }
    }
    // Truncate the ret array to include only valid indices.
    ret.length = idx;
    return ret;
  }
}
