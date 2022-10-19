import { BehaviorSubject, filter, first, Subject, takeUntil } from 'rxjs';
import { GgViewport } from './gg-viewport';
import { BaseGgRenderer } from './entities/base-gg-renderer';

type CanvasAppDescr = { canvas: HTMLCanvasElement, renderer?: BaseGgRenderer };

export class GgViewportManager {

  private static _instance: GgViewportManager | null;
  static get instance(): GgViewportManager {
    if (!this._instance) {
      this._instance = new GgViewportManager();
    }
    return this._instance;
  }

  private constructor() {
    setTimeout(async () => {
      let retries = 120;
      let stage: HTMLDivElement | null = null;
      while (retries > 0) {
        retries--;
        stage = document.getElementById('gg-stage') as HTMLDivElement;
        if (stage) {
          break;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      if (!stage) {
        this.gameStage$.error(new Error('Div with id "gg-stage" not found in 30 seconds'));
      } else {
        GgViewport.instance.subscribeOnViewportSize()
          .pipe(takeUntil(this.destroyed))
          .subscribe((size) => {
            for (const zIndex of Object.keys(this.canvases)) {
              const canvasDescr = this.canvases[+zIndex];
              if (canvasDescr.renderer && !canvasDescr.renderer.rendererOptions.forceRendererSize) {
                canvasDescr.renderer.resize(size);
              }
              canvasDescr.canvas.width = size.x;
              canvasDescr.canvas.height = size.y;
            }
          });
        this.gameStage$.next(stage);
      }
    }, 0);
  }

  private readonly canvases: { [key: number]: CanvasAppDescr } = {};
  private gameStage$: BehaviorSubject<HTMLDivElement | null> = new BehaviorSubject<HTMLDivElement | null>(null);
  protected destroyed: Subject<void> = new Subject();

  private getStageAsync(): Promise<HTMLDivElement> {
    const current = this.gameStage$.getValue();
    if (current) {
      return Promise.resolve(current);
    }
    return Promise.race([this.gameStage$.pipe(
      takeUntil(this.destroyed),
      filter(x => !!x),
      first()
    ).toPromise(),
      new Promise((resolve, reject) => {
        setTimeout(() => {
          reject('Cannot find div with id "gg-stage" in 30 seconds');
        }, 30000);
      })
    ]) as Promise<HTMLDivElement>;
  }

  public async createCanvas(zIndex: number): Promise<HTMLCanvasElement> {
    zIndex = Math.round(zIndex);
    if (this.canvases[zIndex]) {
      throw new Error(`Cannot add canvas on zIndex ${zIndex}. Index is locked by another canvas`);
    }
    const stage = await this.getStageAsync();
    const canvas: HTMLCanvasElement = document.createElement('canvas');
    await this.registerCanvas(canvas, zIndex);
    stage.appendChild(canvas);
    return canvas;
  }

  public async registerCanvas(canvas: HTMLCanvasElement, zIndex: number): Promise<void> {
    canvas.style.zIndex = '' + zIndex;
    canvas.style.position = 'absolute';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.id = 'canvas-' + zIndex;
    this.canvases[zIndex] = { canvas };
    const size = GgViewport.instance.getCurrentViewportSize();
    canvas.width = size.x;
    canvas.height = size.y;
  }

  public async assignRendererToCanvas(renderer: BaseGgRenderer, canvas: HTMLCanvasElement): Promise<void> {
    if (!GgViewport.instance.isActive) {
      GgViewport.instance.activate();
    }
    let zIndex: number | null = null;
    let maxExistingZIndex = 0;
    for (const index in this.canvases) {
      if (this.canvases[index].canvas === canvas) {
        zIndex = +index;
        break;
      }
      maxExistingZIndex = +index;
    }
    if (!zIndex) {
      zIndex = maxExistingZIndex + 1;
      await this.registerCanvas(canvas, zIndex);
    }
    this.canvases[zIndex].renderer = renderer;
    if (!renderer.rendererOptions.forceRendererSize) {
      renderer.resize(GgViewport.instance.getCurrentViewportSize());
    }
  }

  // TODO remove canvas logic
}
