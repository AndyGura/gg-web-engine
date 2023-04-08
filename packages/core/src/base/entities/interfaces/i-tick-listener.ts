import { Subject } from 'rxjs';
import { GgEntity } from '../gg-entity';

/**
 * Engine's default tick orders: the less value, the earlier tick will be run.
 */
export enum GGTickOrder {
  INPUT_CONTROLLERS = 0,
  PHYSICS_SIMULATION = 200,
  OBJECTS_BINDING = 400,
  ANIMATION_MIXERS = 600,
  CONTROLLERS = 800,
  RENDERING = 1000,
  POST_RENDERING = 1200,
}

/**
 * An interface for world entities, which need to do some routine on each world clock tick
 */
export interface ITickListener {

  /**
   * will receive [elapsed time, delta] of each world clock tick
   */
  tick$: Subject<[number, number]>;

  /**
   * the priority of ticker: the less value, the earlier tick will be run.
   */
  readonly tickOrder: GGTickOrder | number;
}

/**
 * A function which determines whether entity implements ITickListener interface
 */
export const isITickListener: (entity: GgEntity) => boolean = entity => (entity as any)?.tick$ instanceof Subject;
