import { LoadProgress } from '../assets/load-progress';

/**
 * What a `ScreenManager` (or a `LoadingScreen`) shows while something loads. `element` is put on
 * top of everything it covers; `setProgress` is called with whatever the load reports.
 */
export interface LoadingView {
  readonly element: HTMLElement;
  setProgress(progress: LoadProgress): void;
  dispose(): void;
}

export type DefaultLoadingViewOptions = {
  /** The word under the cube. `'Loading'` by default. */
  label?: string;
};

const CUBELET = 36; // px, one of the 2x2x2 small cubes
const LIFT = 30; // px the accent cubelet rises out of the block
const SPIN_MS = 7000;
const LIFT_MS = 1800;

type FaceColors = { top: string; bottom: string; front: string; back: string; left: string; right: string };

const BLOCK_FACES: FaceColors = {
  top: '#e3e8ef',
  bottom: '#4b5468',
  front: '#a9b2c3',
  back: '#8892a6',
  left: '#7a8499',
  right: '#69728a',
};
const ACCENT_FACES: FaceColors = {
  top: 'linear-gradient(135deg, #b5f6ff, #67e3f9)',
  bottom: '#0e6f86',
  front: 'linear-gradient(160deg, #3fe0f5, #0e8fa6)',
  back: 'linear-gradient(160deg, #7c5cf0, #4b2bb0)',
  left: 'linear-gradient(160deg, #3fe0f5, #0e8fa6)',
  right: 'linear-gradient(160deg, #8b6cf6, #5b2fc0)',
};

/** One small cube: six faces around its center, placed by `transform` in the rig's space. */
function cubelet(colors: FaceColors, edge: string, transform: string): HTMLElement {
  const cube = document.createElement('div');
  Object.assign(cube.style, {
    position: 'absolute',
    left: `${-CUBELET / 2}px`,
    top: `${-CUBELET / 2}px`,
    width: `${CUBELET}px`,
    height: `${CUBELET}px`,
    transformStyle: 'preserve-3d',
    transform,
  });
  const h = CUBELET / 2;
  const faces: [keyof FaceColors, string][] = [
    ['front', `translateZ(${h}px)`],
    ['back', `rotateY(180deg) translateZ(${h}px)`],
    ['right', `rotateY(90deg) translateZ(${h}px)`],
    ['left', `rotateY(-90deg) translateZ(${h}px)`],
    ['top', `rotateX(90deg) translateZ(${h}px)`],
    ['bottom', `rotateX(-90deg) translateZ(${h}px)`],
  ];
  for (const [side, faceTransform] of faces) {
    const face = document.createElement('div');
    Object.assign(face.style, {
      position: 'absolute',
      inset: '0',
      boxSizing: 'border-box',
      background: colors[side],
      border: `1.5px solid ${edge}`,
      transform: faceTransform,
    });
    cube.appendChild(face);
  }
  return cube;
}

/**
 * The engine's loading view: an opaque dark backdrop with a slowly turning 2x2x2 block, whose
 * corner cube keeps lifting out and settling back, and "Loading" under it. Once a load reports
 * progress, a thin bar and a percentage join the label. Plain DOM with inline styles and the Web
 * Animations API (no stylesheet is added to the page); without that API, or with
 * `prefers-reduced-motion: reduce`, the cube stands still.
 *
 * `ScreenManager` shows it while a screen enters, and `LoadingScreen.show()` puts it over the page
 * for any other load. Restyle it through the `gg-loading` classes (`gg-loading`,
 * `gg-loading__cube`, `gg-loading__label`, `gg-loading__bar`, `gg-loading__fill`), or replace it
 * with any other `LoadingView`.
 */
export class DefaultLoadingView implements LoadingView {
  public readonly element: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly label: HTMLElement;
  private readonly labelText: string;
  private readonly animations: Animation[] = [];

  constructor(options: DefaultLoadingViewOptions = {}) {
    this.labelText = options.label ?? 'Loading';
    this.element = document.createElement('div');
    this.element.className = 'gg-loading';
    this.element.setAttribute('role', 'progressbar');
    this.element.setAttribute('aria-valuemin', '0');
    this.element.setAttribute('aria-valuemax', '100');
    this.element.setAttribute('aria-label', this.labelText);
    Object.assign(this.element.style, {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '18px',
      backgroundColor: '#0e1626',
      backgroundImage: 'radial-gradient(ellipse at 50% 42%, #133a4c 0%, #0e1626 55%, #1b1538 100%)',
      color: '#d7eef6',
      font: '600 13px system-ui, -apple-system, "Segoe UI", sans-serif',
      letterSpacing: '0.32em',
      textTransform: 'uppercase',
      userSelect: 'none',
    });

    // the cube: a perspective stage, a rig turning around the vertical axis, 8 cubelets in it
    const stage = document.createElement('div');
    stage.className = 'gg-loading__cube';
    Object.assign(stage.style, {
      position: 'relative',
      width: `${CUBELET * 4}px`,
      height: `${CUBELET * 4 + LIFT}px`,
      perspective: '700px',
    });
    const glow = document.createElement('div');
    Object.assign(glow.style, {
      position: 'absolute',
      left: '50%',
      bottom: '0',
      width: `${CUBELET * 4}px`,
      height: `${CUBELET}px`,
      transform: 'translateX(-50%)',
      borderRadius: '50%',
      background: 'radial-gradient(closest-side, rgba(34, 211, 238, 0.45), rgba(34, 211, 238, 0))',
    });
    const rig = document.createElement('div');
    Object.assign(rig.style, {
      position: 'absolute',
      left: '50%',
      top: `${CUBELET * 2 + LIFT}px`,
      width: '0',
      height: '0',
      transformStyle: 'preserve-3d',
      transform: 'rotateX(-30deg) rotateY(45deg)',
    });
    let accent: HTMLElement | null = null;
    const at = (i: number, j: number, k: number, lift = 0) =>
      `translate3d(${(i - 0.5) * CUBELET}px, ${(j - 0.5) * CUBELET - lift}px, ${(k - 0.5) * CUBELET}px)`;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 2; k++) {
          // the top corner nearest the viewer is the lifting accent cube, as on the engine's banner
          const isAccent = i === 1 && j === 0 && k === 1;
          const cube = isAccent
            ? cubelet(ACCENT_FACES, '#e6fbff', at(i, j, k))
            : cubelet(BLOCK_FACES, '#1b2236', at(i, j, k));
          if (isAccent) {
            accent = cube;
          }
          rig.appendChild(cube);
        }
      }
    }
    stage.append(glow, rig);

    this.label = document.createElement('div');
    this.label.className = 'gg-loading__label';
    this.bar = document.createElement('div');
    this.bar.className = 'gg-loading__bar';
    Object.assign(this.bar.style, {
      width: '160px',
      height: '3px',
      borderRadius: '2px',
      background: 'rgba(255, 255, 255, 0.12)',
      overflow: 'hidden',
      visibility: 'hidden',
    });
    this.fill = document.createElement('div');
    this.fill.className = 'gg-loading__fill';
    Object.assign(this.fill.style, {
      width: '0%',
      height: '100%',
      background: 'linear-gradient(90deg, #22d3ee, #8b5cf6)',
      transition: 'width 120ms linear',
    });
    this.bar.appendChild(this.fill);
    this.element.append(stage, this.label, this.bar);
    this.setProgress({ fraction: 0, loadedItems: 0, totalItems: 0, bytesLoaded: 0, bytesTotal: 0, current: null });

    const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion && typeof rig.animate === 'function') {
      this.animations.push(
        rig.animate(
          [{ transform: 'rotateX(-30deg) rotateY(45deg)' }, { transform: 'rotateX(-30deg) rotateY(405deg)' }],
          { duration: SPIN_MS, iterations: Infinity },
        ),
        accent!.animate(
          [
            { transform: at(1, 0, 1), easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
            { transform: at(1, 0, 1, LIFT), offset: 0.45, easing: 'ease-in-out' },
            { transform: at(1, 0, 1, LIFT), offset: 0.6, easing: 'cubic-bezier(0.6, 0, 0.8, 0.4)' },
            { transform: at(1, 0, 1), offset: 0.9 },
            { transform: at(1, 0, 1) },
          ],
          { duration: LIFT_MS, iterations: Infinity },
        ),
        glow.animate([{ opacity: 0.55 }, { opacity: 1, offset: 0.5 }, { opacity: 0.55 }], {
          duration: LIFT_MS,
          iterations: Infinity,
        }),
      );
    }
  }

  public setProgress(progress: LoadProgress): void {
    const fraction = Math.min(1, Math.max(0, progress.fraction));
    const percent = Math.round(fraction * 100);
    // the bar appears with the first progress reported; until then the cube alone says "busy"
    if (fraction > 0) {
      this.bar.style.visibility = 'visible';
    }
    this.fill.style.width = `${percent}%`;
    this.label.textContent = fraction > 0 ? `${this.labelText} ${percent}%` : this.labelText;
    this.element.setAttribute('aria-valuenow', `${percent}`);
  }

  public dispose(): void {
    for (const animation of this.animations) {
      animation.cancel();
    }
    this.animations.length = 0;
    this.element.remove();
  }
}
