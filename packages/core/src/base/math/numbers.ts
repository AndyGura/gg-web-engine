export const averageAngle = (angleA: number, angleB: number, factor: number = 0.5) => {
  while (Math.abs(angleA - angleB) > Math.PI) {
    angleB += Math.PI * (angleA > angleB ? 2 : -2);
  }
  return angleA * (1 - factor) + angleB * factor;
}
