import { Entity2d, Gg2dWorld, IEntity, PausableClock, Point2, TickOrder } from '@gg-web-engine/core';
import { Subscription } from 'rxjs';

export interface ShapeSpawnerSettings {
  intervalSeconds?: number;
  /** where new shapes appear, in meters (the 2D world's unit, y down) */
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
          shape: { shape: 'BOX', dimensions: { x: 0.25, y: 0.25 } },
          body: { mass: 1 },
        });
      } else if (r < 2 / 6) {
        item = world.addPrimitiveRigidBody({ shape: { shape: 'CIRCLE', radius: 0.13 }, body: { mass: 1 } });
      } else if (r < 3 / 6) {
        item = world.addPrimitiveRigidBody({
          shape: { shape: 'CAPSULE', radius: 0.1, centersDistance: 0.15 },
          body: { mass: 1 },
        });
      } else if (r < 4 / 6) {
        item = world.addPrimitiveRigidBody({
          shape: {
            shape: 'CONVEX_HULL',
            vertices: [
              { x: 0, y: -0.15 },
              { x: 0.13, y: 0.1 },
              { x: 0, y: 0 },
              { x: -0.13, y: 0.1 },
              { x: 0.05, y: -0.05 },
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
              { x: -0.15, y: -0.15 },
              { x: 0, y: -0.15 },
              { x: 0, y: 0 },
              { x: 0.15, y: 0 },
              { x: 0.15, y: 0.15 },
              { x: -0.15, y: 0.15 },
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
              { position: { x: -0.15, y: 0 }, shape: { shape: 'CIRCLE', radius: 0.08 } },
              { position: { x: 0.15, y: 0 }, shape: { shape: 'CIRCLE', radius: 0.08 } },
              { shape: { shape: 'BOX', dimensions: { x: 0.3, y: 0.04 } } },
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
