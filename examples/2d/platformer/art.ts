// Every picture the game needs is drawn on a canvas at startup; game.screen.ts hands each canvas to
// the renderer as a texture (`factory.createTextureFromCanvas`), so the example ships no image files.

type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

function paint(width: number, height: number, draw: Draw): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!, width, height);
  return canvas;
}

/** a sky gradient: the scene background, fixed to the screen behind everything */
export const drawSky = () =>
  paint(256, 512, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#5fb4e8');
    gradient.addColorStop(1, '#d8f0fb');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });

/** a row of hills, seamless left to right (each wave fits the width a whole number of times) */
export const drawHills = (color: string, waves: [count: number, amplitude: number][]) =>
  paint(512, 600, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h - 2);
    for (let x = 0; x <= w; x += 4) {
      const y = waves.reduce((sum, [count, amplitude]) => sum + amplitude * Math.sin((2 * Math.PI * count * x) / w), 0);
      ctx.lineTo(x, 100 + y);
    }
    // the last rows stay transparent: the texture repeats, and a filled bottom row would bleed into
    // the top edge as a faint line (they end up behind the ground anyway)
    ctx.lineTo(w, h - 2);
    ctx.lineTo(0, h - 2);
    ctx.fill();
  });

/** a few fluffy clouds on a transparent strip */
export const drawClouds = () =>
  paint(1024, 200, ctx => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (const [x, y, size] of [
      [120, 80, 34],
      [460, 50, 26],
      [800, 110, 40],
    ]) {
      for (const [dx, dy, r] of [
        [0, 0, 1],
        [-1.1, 0.35, 0.7],
        [1.1, 0.3, 0.75],
      ]) {
        ctx.beginPath();
        ctx.arc(x + dx * size, y + dy * size, r * size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

/** a soft white dot - coin sparks and dust puffs, tinted per particle */
export const drawSoftDot = () =>
  paint(32, 32, ctx => {
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
  });

/** a plain white rectangle - confetti, tinted and spun per particle */
export const drawConfetti = () =>
  paint(8, 4, (ctx, w, h) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
  });
