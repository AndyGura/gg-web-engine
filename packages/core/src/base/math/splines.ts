export const cubicSplineInterpolation = (
  x: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  m0: number,
  m1: number,
) => {
  const h = x1 - x0;
  return (
    ((m0 + m1 - (2 * (y1 - y0)) / h) / h ** 2) * (x - x0) ** 3 +
    (((3 * (y1 - y0)) / h - 2 * m0 - m1) / h) * (x - x0) ** 2 +
    m0 * (x - x0) +
    y0
  );
};
