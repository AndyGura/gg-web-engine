import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { Gg3dWorld, Gg3dWorldWithPhysics, LoadingScreen, PhysicsTypeDocRepo3D, TypedGg3dWorld } from '@gg-web-engine/core';
import { ThreeGgWorld, ThreeSceneComponent, ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { WebAudioGgWorld3D, WebAudioScene3dComponent, WebAudioTypeDocRepo3D } from '@gg-web-engine/audio';
import { filter } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { GameRunner } from './game-runner';
import { GameFactory } from './game-factory';
import { Multiplayer } from './multiplayer';
import { createPhysicsWorld, selectedPhysicsBackend } from './backends';

export type FlyCityTypeDoc = {
  vTypeDoc: ThreeVisualTypeDocRepo,
  pTypeDoc: PhysicsTypeDocRepo3D,
  aTypeDoc: WebAudioTypeDocRepo3D,
};
// the physics engine is picked at startup (see backends.ts), so the world is typed with core's
// physics interfaces rather than an adapter's
export type FlyCityWorld = Gg3dWorldWithPhysics<TypedGg3dWorld<ThreeGgWorld, Gg3dWorld, WebAudioGgWorld3D>>;

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

  /** set when the page URL carries `?room=` */
  mp: Multiplayer | null = null;
  mpStatus: string = '';
  copied: boolean = false;

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
    // the engine's loading screen, up until the game runs; a level reload (L) comes back through here
    const loading = LoadingScreen.show();
    this.world = new Gg3dWorld({
      visualScene: new ThreeSceneComponent(),
      physicsWorld: await createPhysicsWorld(),
      audioScene: new WebAudioScene3dComponent(),
    });
    // multiplayer when the URL carries a room; the network controller exists before any car spawns,
    // so chunk cars can be marked shared as they load
    const roomId = Multiplayer.roomIdFromUrl();
    this.mp = roomId ? new Multiplayer(this.world, roomId) : null;
    if (this.mp) {
      this.world.addEntity(this.mp.net);
    }
    const factory: GameFactory = new GameFactory(this.world, this.mp);
    const [renderer, cityMapGraph, mapBounds] = await factory.initGame(this.canvas.nativeElement);
    if (this.mp) {
      this.mp.camera = renderer;
    }
    await factory.spawnLambo();

    this.runner = new GameRunner(this.http, this.world, renderer, cityMapGraph, mapBounds, this.mp);
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
      // disposing the renderer released the canvas's WebGL context for good, so the new world
      // renders into a fresh canvas
      const oldCanvas = this.canvas.nativeElement;
      const newCanvas = oldCanvas.cloneNode() as HTMLCanvasElement;
      oldCanvas.replaceWith(newCanvas);
      this.canvas = new ElementRef(newCanvas);
      this.initGame().then();
    });

    this.runner.state$.subscribe(() => {
      this.cdr.markForCheck();
    });

    if (this.mp) {
      const mp = this.mp;
      this.mpStatus = 'connecting...';
      this.cdr.markForCheck();
      mp.net.peers$.subscribe(peers => {
        this.mpStatus = `${peers.length + 1} player${peers.length ? 's' : ''} on ${selectedPhysicsBackend()} (${mp.signalingKind} signaling)`;
        this.cdr.markForCheck();
      });
      await mp.net.connect();
    }

    this.world.start();
    loading.hide();
  }

  createRoom() {
    Multiplayer.createRoom();
  }

  async copyRoomUrl() {
    if (this.mp) {
      await navigator.clipboard.writeText(this.mp.roomUrl);
      this.copied = true;
      this.cdr.markForCheck();
      setTimeout(() => {
        this.copied = false;
        this.cdr.markForCheck();
      }, 1500);
    }
  }
}
