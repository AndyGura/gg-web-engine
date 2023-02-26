import { GgVisualScene } from './gg-visual-scene';
import { GgBox } from '../models/geometry-nodes';

export interface GgObject<D, R> {
  position: D;
  rotation: R;
  scale: D;

  visible: boolean;

  name: string;

  isEmpty(): boolean;

  popChild(name: string): GgObject<D, R> | null;

  getBoundings(): GgBox<D>;

  clone(): GgObject<D, R>;

  addToWorld(world: GgVisualScene<D, R>): void;

  removeFromWorld(world: GgVisualScene<D, R>): void;

  dispose(): void;
}
