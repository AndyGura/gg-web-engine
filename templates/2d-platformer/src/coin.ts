import {
  CharacterController2dEntity,
  Entity2d,
  Gg2dWorld,
  Gg2dWorldSceneTypeRepo,
  Gg2dWorldTypeDocRepo,
  Point2,
  Trigger2dEntity,
} from '@gg-web-engine/core';
import { Observable, Subject } from 'rxjs';

export interface CoinSettings {
  position?: Point2;
  radius?: number;
}

/**
 * A collectible coin: a round trigger volume (no collision response) with a spinning gold disc
 * drawn on top. When a character touches it, `onCollected` emits the coin itself - level JSON binds
 * that event to the built-in "RemoveEntity" blueprint node (see level.ts), and main.ts listens to it
 * to count the score.
 *
 * The built-in "Trigger" level class is an invisible box whose `onEntityEntered` emits the entity
 * that entered (the player); this class exists to add a visual and an event carrying the coin.
 */
export class Coin extends Trigger2dEntity {
  static readonly entityTypeName: string = 'Coin';

  private readonly collected$ = new Subject<Coin>();
  private collected = false;

  /** emits this coin, once, when a character touches it */
  get onCollected(): Observable<Coin> {
    return this.collected$.asObservable();
  }

  constructor(world: Gg2dWorld, settings: CoinSettings) {
    const position = settings.position ?? { x: 0, y: 0 };
    const radius = settings.radius ?? 12;
    if (!world.physicsWorld || !world.visualScene) {
      throw new Error('Coin needs a world with both a physics world and a visual scene');
    }
    super(world.physicsWorld.factory.createTrigger({ shape: 'CIRCLE', radius }, { position }));
    this.position = position;

    // the look: a gold disc with a darker rim
    const disc = world.visualScene.factory.createCircle(radius, {
      color: 0xffd23f,
      stroke: { width: 3, color: 0xd99a00 },
    });
    const sprite = new Entity2d({ object2D: disc });
    sprite.position = position;
    sprite.tick$.subscribe(([elapsed]) => {
      // "spin" by squashing horizontally, and bob up and down a little
      disc.scale = { x: Math.cos(elapsed / 300 + position.x / 50), y: 1 };
      sprite.position = { x: position.x, y: position.y + Math.sin(elapsed / 400 + position.x / 80) * 3 };
    });
    // a child entity: removed and disposed together with the coin
    this.addChildren(sprite);

    this.onEntityEntered.subscribe(entity => {
      if (!this.collected && entity instanceof CharacterController2dEntity) {
        this.collected = true;
        this.collected$.next(this);
      }
    });
  }
}

/** makes the "Coin" class available to level JSON; call before loading a level that uses it */
export function registerCoin<T extends Gg2dWorldTypeDocRepo, S extends Gg2dWorldSceneTypeRepo<T>>(
  world: Gg2dWorld<T, S>,
): void {
  world.loader.registerClass('Coin', (w: Gg2dWorld<T, S>, settings: CoinSettings) => new Coin(w, settings));
}
