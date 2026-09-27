import { Entity2d, Gg2dWorld, IEntity, PausableClock, Point2, TickOrder } from '@gg-web-engine/core';
import { Subscription } from 'rxjs';

export interface ShapeSpawnerSettings {
  intervalSeconds?: number;
  area: { min: Point2; max: Point2 };
}

export class ShapeSpawner extends IEntity {
  static readonly entityTypeName: string = 'ShapeSpawner';
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
      const r = Math.random();
      if (r < 1 / 6) {
        item = world.addPrimitiveRigidBody({
          shape: { shape: 'SQUARE', dimensions: { x: 25, y: 25 } },
          body: { mass: 1 },
        });
      } else if (r < 2 / 6) {
        item = world.addPrimitiveRigidBody({ shape: { shape: 'CIRCLE', radius: 13 }, body: { mass: 1 } });
      } else if (r < 3 / 6) {
        item = world.addPrimitiveRigidBody({
          shape: { shape: 'CAPSULE', radius: 10, centersDistance: 15 },
          body: { mass: 1 },
        });
      } else if (r < 4 / 6) {
        item = world.addPrimitiveRigidBody({
          shape: {
            shape: 'CONVEX_HULL',
            vertices: [
              { x: 0, y: -15 },
              { x: 13, y: 10 },
              { x: 0, y: 0 },
              { x: -13, y: 10 },
              { x: 5, y: -5 },
            ],
          },
          body: { mass: 1 },
        });
      } else if (r < 5 / 6) {
        item = world.addPrimitiveRigidBody({
          shape: {
            // non-convex L-shaped polygon, to check that concave shapes aren't silently
            // reduced to their convex hull
            shape: 'POLYGON',
            vertices: [
              { x: -15, y: -15 },
              { x: 0, y: -15 },
              { x: 0, y: 0 },
              { x: 15, y: 0 },
              { x: 15, y: 15 },
              { x: -15, y: 15 },
            ],
          },
          body: { mass: 1 },
        });
      } else {
        item = world.addPrimitiveRigidBody({
          shape: {
            // dumbbell: two circular weights joined by a bar, to check that a rigid body built
            // from several offset child shapes behaves as one solid piece
            shape: 'COMPOUND',
            children: [
              { position: { x: -15, y: 0 }, shape: { shape: 'CIRCLE', radius: 8 } },
              { position: { x: 15, y: 0 }, shape: { shape: 'CIRCLE', radius: 8 } },
              { shape: { shape: 'SQUARE', dimensions: { x: 30, y: 4 } } },
            ],
          },
          body: { mass: 1 },
        });
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
