import { Gg3dWorld, Gg3dWorldTypeDocVPatch, IEntity, PausableClock, Point3, TickOrder } from '@gg-web-engine/core';
import { ThreeVisualTypeDocRepo } from '@gg-web-engine/three';
import { Object3D } from 'three';
import { Subscription } from 'rxjs';

export interface GlbSpawnerSettings {
  intervalSeconds?: number;
  area: { min: Point3; max: Point3 };
  lifetimeSeconds?: number;
  baseUrl: string;
  glbIds: string[];
}

export class GlbSpawner extends IEntity {
  public readonly tickOrder = TickOrder.CONTROLLERS;
  private readonly clock: PausableClock;
  private readonly spawnSub: Subscription;

  constructor(world: Gg3dWorld<Gg3dWorldTypeDocVPatch<ThreeVisualTypeDocRepo>>, settings: GlbSpawnerSettings) {
    super();
    const { min, max } = settings.area;
    const { baseUrl, glbIds, lifetimeSeconds = 30 } = settings;
    this.clock = world.createClock(true);
    this.clock.tickRateLimit = 1 / (settings.intervalSeconds ?? 0.5);
    this.spawnSub = this.clock.tick$.subscribe(async () => {
      const glbId = glbIds[Math.floor(Math.random() * glbIds.length)];
      const { entities } = await world.loader.loadGgGlb(`${baseUrl}/${glbId}`, {
        position: {
          x: min.x + Math.random() * (max.x - min.x),
          y: min.y + Math.random() * (max.y - min.y),
          z: min.z + Math.random() * (max.z - min.z),
        },
      });
      const item = entities[0];
      item.object3D?.nativeMesh.traverse((obj: Object3D) => {
        obj.castShadow = true;
        obj.receiveShadow = true;
      });
      world.addEntity(item);
      setTimeout(() => {
        world.removeEntity(item, true);
      }, lifetimeSeconds * 1000);
    });
  }

  public override dispose(): void {
    this.spawnSub.unsubscribe();
    this.clock.stop();
    super.dispose();
  }
}
