import {
  CharacterController2dEntity,
  Entity2d,
  Gg2dWorld,
  Gg2dWorldSceneTypeRepo,
  Gg2dWorldTypeDocRepo,
  Point2,
  Trigger2dEntity,
} from '@gg-web-engine/core';
import { filter, Observable, Subject } from 'rxjs';

// The level's own entity classes. Each is a trigger (a physics volume with no collision response)
// with a drawing on top, and is registered with the level loader at the bottom of this file, so the
// level JSON (level.ts) can place it by class name. They know nothing about lives or scores: they
// only report what touched them, and game.screen.ts decides what that means.

export type CoinSettings = { position: Point2 };
export type SpikesSettings = { position: Point2; width: number };
export type SlimeSettings = { from: number; to: number; speed: number };
export type FlagSettings = { position: Point2; goal?: boolean };

/** the visual and physics factories of a world that has both halves */
function factories(world: Gg2dWorld) {
  if (!world.physicsWorld || !world.visualScene) {
    throw new Error('the level needs a world with both a physics world and a visual scene');
  }
  return { visual: world.visualScene.factory, physics: world.physicsWorld.factory };
}

/** the characters entering a trigger - the only thing that can touch these entities is the player */
const charactersEntering = (trigger: Trigger2dEntity) =>
  trigger.onEntityEntered.pipe(filter(entity => entity instanceof CharacterController2dEntity));

/**
 * A collectible coin: a spinning gold disc. When the player touches it, `onCollected` emits the
 * coin itself, once - the level JSON removes it on that event, the game counts it.
 */
export class Coin extends Trigger2dEntity {
  static readonly entityTypeName: string = 'Coin';

  private readonly collected$ = new Subject<Coin>();
  private collected = false;

  /** emits this coin, once, when the player touches it */
  get onCollected(): Observable<Coin> {
    return this.collected$.asObservable();
  }

  constructor(world: Gg2dWorld, settings: CoinSettings) {
    const { visual, physics } = factories(world);
    const radius = 12;
    super(physics.createTrigger({ shape: 'CIRCLE', radius }, { position: settings.position }));
    this.position = settings.position;

    const disc = visual.createCircle(radius, { color: 0xffd23f, stroke: { width: 3, color: 0xd99a00 } });
    const sprite = new Entity2d({ object2D: disc });
    sprite.position = settings.position;
    sprite.tick$.subscribe(([elapsed]) => {
      // "spin" by squashing horizontally, and bob up and down a little
      const { x, y } = settings.position;
      disc.scale = { x: Math.cos(elapsed / 300 + x / 50), y: 1 };
      sprite.position = { x, y: y + Math.sin(elapsed / 400 + x / 80) * 3 };
    });
    // a child entity: removed and disposed together with the coin
    this.addChildren(sprite);

    charactersEntering(this).subscribe(() => {
      if (!this.collected) {
        this.collected = true;
        this.collected$.next(this);
      }
    });
  }
}

/** A row of spikes standing on the ground at `position`. The game listens to `onEntityEntered`. */
export class Spikes extends Trigger2dEntity {
  static readonly entityTypeName: string = 'Spikes';

  constructor(world: Gg2dWorld, settings: SpikesSettings) {
    const { visual, physics } = factories(world);
    const { position, width } = settings;
    const height = 24;
    // the volume is a little smaller than the drawing, so grazing a tip doesn't count
    super(physics.createTrigger({ shape: 'BOX', dimensions: { x: width - 12, y: 14 } }));
    this.position = { x: position.x, y: position.y - 7 };

    // one polygon zig-zagging along the row: a tooth every 20 px. Vertices are in the drawing's own
    // frame, which sits at `position` (the middle of the row, on the ground)
    const teeth = Math.round(width / 20);
    const vertices: Point2[] = [{ x: -width / 2, y: 0 }];
    for (let i = 0; i < teeth; i++) {
      vertices.push({ x: -width / 2 + (i + 0.5) * (width / teeth), y: -height });
      vertices.push({ x: -width / 2 + (i + 1) * (width / teeth), y: 0 });
    }
    const sprite = new Entity2d({
      object2D: visual.createPolygon(vertices, { color: 0xc7ccd6, stroke: { width: 2, color: 0x4a4f5c } }),
    });
    sprite.position = position;
    this.addChildren(sprite);
  }
}

/**
 * A slime walking back and forth on the ground between `from` and `to`: a trigger moved every tick
 * (no rigid body, so it never pushes the player around). The game listens to `onEntityEntered` and
 * tells a stomp from a side hit by where the player is; `squash()` takes it out of the level.
 */
export class Slime extends Trigger2dEntity {
  static readonly entityTypeName: string = 'Slime';

  constructor(world: Gg2dWorld, settings: SlimeSettings) {
    const { visual, physics } = factories(world);
    const radius = 18;
    const y = -radius; // standing on the ground
    super(physics.createTrigger({ shape: 'CIRCLE', radius: radius - 4 }));
    this.position = { x: settings.from, y };

    // a purple blob with two eyes: three drawings (body, eye whites, pupils - a COMPOUND shape draws
    // several circles as one object) moved and scaled together, the eyes on top
    const circles = (r: number, dx: number) =>
      visual.createPrimitive(
        {
          shape: 'COMPOUND',
          children: [3, 11].map(x => ({ shape: { shape: 'CIRCLE', radius: r }, position: { x: x + dx, y: -6 } })),
        },
        { color: r > 3 ? 0xffffff : 0x1a1a1a },
      );
    const parts = [
      visual.createCircle(radius, { color: 0x8e5bd6, stroke: { width: 3, color: 0x3d2363 } }),
      circles(4, 0),
      circles(2, 1.5),
    ].map((object2D, zIndex) => {
      object2D.zIndex = zIndex;
      return new Entity2d({ object2D });
    });
    this.addChildren(...parts);

    let direction = 1;
    this.tick$.subscribe(([elapsed, delta]) => {
      let x = this.position.x + direction * settings.speed * (delta / 1000);
      if (x > settings.to || x < settings.from) {
        direction = -direction;
        x = Math.min(settings.to, Math.max(settings.from, x));
      }
      this.position = { x, y };
      // wobble while walking, and look where it goes (a negative x scale mirrors the eyes)
      const wobble = Math.sin(elapsed / 90) * 0.08;
      for (const part of parts) {
        part.object2D!.scale = { x: direction * (1 + wobble), y: 1 - wobble };
        part.position = { x, y: y + wobble * radius };
      }
    });
  }

  /** removes the slime from the level - after the current tick, since the world is iterating its
   * entities right now (removing one mid-tick would skip another's tick) */
  squash(): void {
    const world = this.world;
    queueMicrotask(() => this.world === world && world?.removeEntity(this, true));
  }
}

/**
 * A flag on a pole planted at `position`: a checkpoint, or with `goal: true` the end of the level.
 * `onReached` emits the flag the first time the player passes it; the cloth turns green (gold for the
 * goal) from then on.
 */
export class Flag extends Trigger2dEntity {
  static readonly entityTypeName: string = 'Flag';

  private readonly reached$ = new Subject<Flag>();
  private reached = false;
  public readonly isGoal: boolean;

  /** emits this flag, once, when the player reaches it */
  get onReached(): Observable<Flag> {
    return this.reached$.asObservable();
  }

  constructor(world: Gg2dWorld, settings: FlagSettings) {
    const { visual, physics } = factories(world);
    const height = settings.goal ? 160 : 110;
    // a tall volume around the pole, so jumping past it counts as reaching it too
    super(physics.createTrigger({ shape: 'BOX', dimensions: { x: 30, y: height + 200 } }));
    this.isGoal = !!settings.goal;
    this.position = { x: settings.position.x, y: settings.position.y - height / 2 - 100 };

    // the pole, and the cloth flying from its top: two drawings at the same place. The cloth is
    // white, so a tint gives it any color
    const top = -height;
    const pole = visual.createPolygon(
      [
        { x: -3, y: 0 },
        { x: -3, y: top },
        { x: 3, y: top },
        { x: 3, y: 0 },
      ],
      { color: 0xe8e2d0, stroke: { width: 2, color: 0x4a3728 } },
    );
    const cloth = visual.createPolygon(
      [
        { x: 3, y: top },
        { x: settings.goal ? 70 : 50, y: top + (settings.goal ? 22 : 15) },
        { x: 3, y: top + (settings.goal ? 44 : 30) },
      ],
      { color: 0xffffff, stroke: { width: 2, color: 0x2b1d14 } },
    );
    cloth.tint = settings.goal ? 0xe94f37 : 0x9aa0a6;
    for (const object2D of [pole, cloth]) {
      const sprite = new Entity2d({ object2D });
      sprite.position = settings.position;
      this.addChildren(sprite);
    }

    charactersEntering(this).subscribe(() => {
      if (!this.reached) {
        this.reached = true;
        cloth.tint = settings.goal ? 0xffd23f : 0x4cd964;
        this.reached$.next(this);
      }
    });
  }
}

/** makes this file's classes available to level JSON; call before loading a level that uses them */
export function registerLevelClasses<T extends Gg2dWorldTypeDocRepo, S extends Gg2dWorldSceneTypeRepo<T>>(
  world: Gg2dWorld<T, S>,
): void {
  world.loader.registerClass('Coin', (w: Gg2dWorld<T, S>, settings: CoinSettings) => new Coin(w, settings));
  world.loader.registerClass('Spikes', (w: Gg2dWorld<T, S>, settings: SpikesSettings) => new Spikes(w, settings));
  world.loader.registerClass('Slime', (w: Gg2dWorld<T, S>, settings: SlimeSettings) => new Slime(w, settings));
  world.loader.registerClass('Flag', (w: Gg2dWorld<T, S>, settings: FlagSettings) => new Flag(w, settings));
}
