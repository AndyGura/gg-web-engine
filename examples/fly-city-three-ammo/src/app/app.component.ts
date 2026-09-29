import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { Gg3dWorld, TypedGg3dWorld } from '@gg-web-engine/core';
import { ThreeGgWorld, ThreeSceneComponent, ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { AmmoGgWorld, AmmoPhysicsTypeDocRepo, AmmoWorldComponent } from '@gg-web-engine/ammo';
import { WebAudioGgWorld3D, WebAudioScene3dComponent, WebAudioTypeDocRepo3D } from '@gg-web-engine/audio';
import { filter } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { GameRunner } from './game-runner';
import { GameFactory } from './game-factory';

export type FlyCityTypeDoc = {
  vTypeDoc: ThreeVisualTypeDocRepo,
  pTypeDoc: AmmoPhysicsTypeDocRepo,
  aTypeDoc: WebAudioTypeDocRepo3D,
};
export type FlyCityWorld = TypedGg3dWorld<ThreeGgWorld, AmmoGgWorld, WebAudioGgWorld3D>;

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class AppComponent implements AfterViewInit {

  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;

  world!: FlyCityWorld;
  runner?: GameRunner;

  showHelpText: boolean = true;
  paused: boolean = false;

  /** Which controls legend to show - 'entering' (walking to a car, no player control) reuses the on-foot legend, since F (cancel) is still live. */
  get legendMode(): 'freecamera' | 'onfoot' | 'driving' {
    const mode = this.runner?.state$.getValue().mode ?? 'freecamera';
    return mode === 'entering' ? 'onfoot' : mode;
  }

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
  ) {
  }

  async ngAfterViewInit(): Promise<void> {
    await this.initGame();
  }

  private async initGame() {
    this.world = new Gg3dWorld({
      visualScene: new ThreeSceneComponent(),
      physicsWorld: new AmmoWorldComponent(),
      audioScene: new WebAudioScene3dComponent(),
    });
    const factory: GameFactory = new GameFactory(this.world);
    const [renderer, cityMapGraph, mapBounds] = await factory.initGame(this.canvas.nativeElement);
    await factory.spawnLambo();

    this.runner = new GameRunner(this.http, this.world, renderer, cityMapGraph, mapBounds);
    await this.runner.audio.initAudio();
    this.runner.setupKeyBindings();

    this.world.keyboardInput.bind('KeyX').pipe(filter(x => x)).subscribe(() => {
      this.showHelpText = !this.showHelpText;
      this.cdr.markForCheck();
    });

    this.world.keyboardInput.bind('KeyP').pipe(filter(x => x)).subscribe(() => {
      this.paused = !this.paused;
      if (this.paused) {
        this.world.pauseWorld();
      } else {
        this.world.resumeWorld();
      }
      this.cdr.markForCheck();
    });

    this.world.keyboardInput.bind('KeyL').pipe(filter(x => x)).subscribe(() => {
      this.runner?.stopGame();
      this.initGame().then();
    });

    this.runner.state$.subscribe(() => {
      this.cdr.markForCheck();
    });

    this.world.start();
  }
}
