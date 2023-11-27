import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { Gg3dWorld } from '@gg-web-engine/core';
import { ThreeSceneComponent } from '@gg-web-engine/three';
import { AmmoWorldComponent } from '@gg-web-engine/ammo';
import { filter } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { GameRunner } from './game-runner';
import { GameFactory } from './game-factory';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements AfterViewInit {

  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;

  world!: Gg3dWorld<ThreeSceneComponent, AmmoWorldComponent>;
  runner?: GameRunner;

  showHelpText: boolean = true;
  paused: boolean = false;

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
  ) {
  }

  async ngAfterViewInit(): Promise<void> {
    await this.initGame();
  }

  private async initGame() {
    console.log('Initializing game');
    this.world = new Gg3dWorld(new ThreeSceneComponent(), new AmmoWorldComponent(), true);
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
