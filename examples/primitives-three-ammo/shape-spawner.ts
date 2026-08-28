import { Entity3d, Gg3dWorld, IEntity, PausableClock, Point3, TickOrder } from '@gg-web-engine/core';
import { Subscription } from 'rxjs';

export interface ShapeSpawnerSettings {
  intervalSeconds?: number;
  area: { min: Point3; max: Point3 };
}

export class ShapeSpawner extends IEntity {
  public readonly tickOrder = TickOrder.CONTROLLERS;
  private readonly clock: PausableClock;
  private readonly spawnSub: Subscription;

  constructor(world: Gg3dWorld, settings: ShapeSpawnerSettings) {
    super();
    const { min, max } = settings.area;
    this.clock = world.createClock(true);
    this.clock.tickRateLimit = 1 / (settings.intervalSeconds ?? 0.5);
    this.spawnSub = this.clock.tick$.subscribe(() => {
      let item: Entity3d;
      const r = Math.random();
      if (r < 0.2) {
        item = world.addPrimitiveRigidBody({
          shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } },
          body: { mass: 1 },
        });
      } else if (r < 0.4) {
        item = world.addPrimitiveRigidBody({
          shape: { shape: 'CAPSULE', radius: 0.5, centersDistance: 1 },
          body: { mass: 1 },
        });
      } else if (r < 0.6) {
        item = world.addPrimitiveRigidBody({
          shape: { shape: 'CYLINDER', radius: 0.5, height: 1 },
          body: { mass: 1 },
        });
      } else if (r < 0.8) {
        item = world.addPrimitiveRigidBody({
          shape: { shape: 'CONE', radius: 0.5, height: 1 },
          body: { mass: 1 },
        });
      } else {
        item = world.addPrimitiveRigidBody({ shape: { shape: 'SPHERE', radius: 0.5 }, body: { mass: 1 } });
      }
      item.position = {
        x: min.x + Math.random() * (max.x - min.x),
        y: min.y + Math.random() * (max.y - min.y),
        z: min.z + Math.random() * (max.z - min.z),
      };
    });
  }

  public override dispose(): void {
    this.spawnSub.unsubscribe();
    this.clock.stop();
    super.dispose();
  }
}
