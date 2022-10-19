import { GgVisualScene } from './gg-visual-scene';

export interface GgObject<D, R> {
  position: D;
  rotation: R;
  scale: D;

  addToWorld(world: GgVisualScene<D, R>): void;

  removeFromWorld(world: GgVisualScene<D, R>): void;

  dispose(): void;
}
