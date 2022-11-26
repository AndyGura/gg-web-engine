export interface BodyOptions<D, R> {
  dynamic: boolean;
  mass: number;
  restitution: number;
  friction: number;
  position: D;
  rotation: R;
}
