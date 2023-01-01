import { GgVisualScene } from './gg-visual-scene';

export interface GgObject<D, R> {
  position: D;
  rotation: R;
  scale: D;

  name: string;

  isEmpty(): boolean;

  popChild(name: string): GgObject<D, R> | null;

  addToWorld(world: GgVisualScene<D, R>): void;

  removeFromWorld(world: GgVisualScene<D, R>): void;

  dispose(): void;
}
