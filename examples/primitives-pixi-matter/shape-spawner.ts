import { Entity2d, Gg2dWorld, IEntity, PausableClock, Point2, TickOrder } from '@gg-web-engine/core';
import { Subscription } from 'rxjs';

export interface ShapeSpawnerSettings {
  intervalSeconds?: number;
  area: { min: Point2; max: Point2 };
}

export class ShapeSpawner extends IEntity {
  public readonly tickOrder = TickOrder.CONTROLLERS;
  private readonly clock: PausableClock;
  private readonly spawnSub: Subscription;

  constructor(world: Gg2dWorld, settings: ShapeSpawnerSettings) {
    super();
    const { min, max } = settings.area;
    this.clock = world.createClock(true);
    this.clock.tickRateLimit = 1 / (settings.intervalSeconds ?? 0.5);
    this.spawnSub = this.clock.tick$.subscribe(() => {
      let item: Entity2d;
      if (Math.random() >= 0.5) {
        item = world.addPrimitiveRigidBody({
          shape: { shape: 'SQUARE', dimensions: { x: 25, y: 25 } },
          body: { mass: 1 },
        });
      } else {
        item = world.addPrimitiveRigidBody({ shape: { shape: 'CIRCLE', radius: 13 }, body: { mass: 1 } });
      }
      item.position = {
        x: min.x + Math.random() * (max.x - min.x),
        y: min.y + Math.random() * (max.y - min.y),
      };
    });
  }

  public override dispose(): void {
    this.spawnSub.unsubscribe();
    this.clock.stop();
    super.dispose();
  }
}
