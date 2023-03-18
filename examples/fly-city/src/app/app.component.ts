import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Gg3dWorld, } from '@gg-web-engine/core';
import { Gg3dVisualScene } from '@gg-web-engine/three';
import { Gg3dPhysicsWorld } from '@gg-web-engine/ammo';
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
export class AppComponent implements OnInit {
  title = 'fly-city';

  @ViewChild('stage') stage!: ElementRef<HTMLCanvasElement>;

  world!: Gg3dWorld<Gg3dVisualScene, Gg3dPhysicsWorld>;
  runner?: GameRunner;


  showHelpText: boolean = true;

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
  ) {
  }

  async ngOnInit(): Promise<void> {
    this.world = new Gg3dWorld(new Gg3dVisualScene(), new Gg3dPhysicsWorld(), true);
    const factory: GameFactory = new GameFactory(this.world);
    const [renderer, cityMapGraph, mapBounds] = await factory.initGame();
    await factory.spawnLambo();

    this.runner = new GameRunner(this.http, this.world, renderer, cityMapGraph, mapBounds);
    await this.runner.audio.initAudio();
    this.runner.setupKeyBindings();

    this.world.keyboardController.bind('KeyX').pipe(filter(x => x)).subscribe(() => {
      this.showHelpText = !this.showHelpText;
      this.cdr.markForCheck();
    });

    this.runner.state$.subscribe(() => {
      this.cdr.markForCheck();
    })

    this.world.start();
  }
}
