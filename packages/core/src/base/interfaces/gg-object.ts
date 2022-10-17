export interface GgObject<D, R> {
  position: D;
  rotation: R;
  scale: D;

  dispose(): void;
}
