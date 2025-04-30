export const tabulateArray = <T>(amount: number, f: (i: number) => T): T[] =>
  Array(amount)
    .fill(null)
    .map((_, i) => f(i));
